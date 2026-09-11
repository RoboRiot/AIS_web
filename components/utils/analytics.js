import { shouldCollectBrowserAnalytics } from "@/app/data/analyticsPolicy.mjs";
import { analyticsPageUrl, redactAnalyticsText } from "@/app/data/analyticsPrivacy.mjs";
import { CLICK_ID_KEYS, createAttributionReader } from "@/app/data/browserAttribution.mjs";
import { createLeadEventDispatcher, ensureGoogleAnalytics } from "@/app/data/browserGoogleAnalytics.mjs";

const VISITOR_KEY = "ais_visitor_id";
const SESSION_KEY = "ais_session_id";
const LAST_PART_SEARCH_KEY = "ais_last_part_search";
const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-L0236JT5N3";
const readAttribution = createAttributionReader();
const dispatchLead = createLeadEventDispatcher();
const memoryIds = new Map();

const randomId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};
export const createLeadId = () => randomId();

const browserStorage = (name) => {
  try { return window[name]; } catch { return undefined; }
};

const storedId = (storage, key) => {
  try {
    const current = storage?.getItem(key);
    if (current) return current;
  } catch { /* Restricted storage. */ }
  if (!memoryIds.has(key)) memoryIds.set(key, randomId());
  const id = memoryIds.get(key);
  try { storage?.setItem(key, id); } catch { /* Use the memory copy. */ }
  return id;
};

const gaEventName = (eventType) => ({
  product_view: "view_item",
  product_select: "select_item",
  form_submit: "generate_lead",
  search: "search",
}[eventType] || eventType);

const sessionAttribution = () => readAttribution({
  href: window.location.href,
  referrer: document.referrer,
  storage: browserStorage("sessionStorage"),
});

export const getLeadAnalyticsContext = (leadId = "") => {
  if (typeof window === "undefined") return {};
  let lastPartSearch = {};
  try {
    lastPartSearch = JSON.parse(browserStorage("sessionStorage")?.getItem(LAST_PART_SEARCH_KEY) || "{}");
  } catch { /* Search attribution is optional. */ }
  return {
    leadId: leadId || createLeadId(),
    visitorId: storedId(browserStorage("localStorage"), VISITOR_KEY),
    sessionId: storedId(browserStorage("sessionStorage"), SESSION_KEY),
    sourcePage: window.location.pathname.slice(0, 300),
    referrer: document.referrer.slice(0, 300),
    search_term: redactAnalyticsText(lastPartSearch?.search_term || "", 100),
    search_kind: String(lastPartSearch?.search_kind || "").slice(0, 40),
    ...sessionAttribution(),
  };
};

const recordWebsiteEvent = (eventType, properties = {}, options = {}) => {
  if (typeof window === "undefined" || navigator.doNotTrack === "1") return;
  if (!shouldCollectBrowserAnalytics({
    hostname: window.location.hostname,
    userAgent: navigator.userAgent,
    webdriver: navigator.webdriver,
  })) return;

  const safeProperties = Object.fromEntries(
    Object.entries({ ...properties, ...sessionAttribution() })
      .filter(([key]) => !CLICK_ID_KEYS.includes(key) && key !== "source")
      .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
      .map(([key, value]) => [key, typeof value === "string" ? redactAnalyticsText(value, 300) : value])
      .slice(0, 20)
  );
  if (eventType === "search" && safeProperties.search_location === "parts_catalog" && safeProperties.search_term) {
    try {
      browserStorage("sessionStorage")?.setItem(LAST_PART_SEARCH_KEY, JSON.stringify({
        search_term: safeProperties.search_term,
        search_kind: safeProperties.search_kind || "keyword",
      }));
    } catch { /* Analytics must never interrupt catalog use. */ }
  }
  const payload = {
    eventType,
    path: window.location.pathname.slice(0, 300),
    referrer: document.referrer.slice(0, 300),
    visitorId: storedId(browserStorage("localStorage"), VISITOR_KEY),
    sessionId: storedId(browserStorage("sessionStorage"), SESSION_KEY),
    occurredAt: new Date().toISOString(),
    properties: safeProperties,
  };
  if (options.recordInternally !== false) {
    fetch("/api/analytics", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), keepalive: true,
    }).catch(() => {});
  }
  if (eventType !== "page_view") {
    // Queue safely even if the Google script has not finished loading. Privacy gates above still apply.
    const gtag = ensureGoogleAnalytics(window, measurementId);
    const gaProperties = {
      ...safeProperties,
      page_path: payload.path,
      page_location: analyticsPageUrl(window.location.href),
      send_to: measurementId,
    };
    if (eventType === "form_submit") {
      dispatchLead({ gtag, properties: gaProperties, storage: browserStorage("localStorage") });
    } else {
      gtag("event", gaEventName(eventType), gaProperties);
    }
  }
};

export const trackWebsiteEvent = (eventType, properties = {}, options = {}) => {
  try { recordWebsiteEvent(eventType, properties, options); } catch {
    // Analytics failure must never turn an accepted inquiry into a form error.
  }
};

export const announceFormOpen = (formType, source = "", leadId = createLeadId()) => {
  trackWebsiteEvent("form_open", { form_type: formType, form_source: source, lead_id: leadId });
  return leadId;
};
