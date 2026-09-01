import { shouldCollectBrowserAnalytics } from "@/app/data/analyticsPolicy.mjs";
import { getLeadEventName } from "@/app/data/leadAnalytics.mjs";

const VISITOR_KEY = "ais_visitor_id";
const SESSION_KEY = "ais_session_id";
const ATTRIBUTION_KEY = "ais_session_attribution";
const LAST_PART_SEARCH_KEY = "ais_last_part_search";
const CLICK_ID_KEYS = ["gclid", "gbraid", "wbraid", "msclkid"];

const randomId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

export const createLeadId = () => randomId();

const storedId = (storage, key) => {
  try {
    const current = storage.getItem(key);
    if (current) return current;
    const next = randomId();
    storage.setItem(key, next);
    return next;
  } catch {
    return randomId();
  }
};

const gaEventName = (eventType) => ({
  product_view: "view_item",
  product_select: "select_item",
  form_submit: "generate_lead",
  search: "search",
}[eventType] || eventType);

const cleanClickId = (value) =>
  String(value || "")
    .replace(/[^a-zA-Z0-9._~-]/g, "")
    .slice(0, 240);

const sessionAttribution = () => {
  try {
    const stored = window.sessionStorage.getItem(ATTRIBUTION_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.acquisition_source && parsed?.landing_path) return parsed;
    }

    const landingUrl = new URL(window.location.href);
    const referrerUrl = document.referrer ? new URL(document.referrer) : null;
    const referrerHost = referrerUrl?.hostname.toLowerCase() || "";
    const currentHost = landingUrl.hostname.toLowerCase();
    const medium = (landingUrl.searchParams.get("utm_medium") || "").toLowerCase();
    const source = (landingUrl.searchParams.get("utm_source") || "").toLowerCase();
    const paid = Boolean(
      CLICK_ID_KEYS.some((key) => landingUrl.searchParams.get(key)) ||
      /(cpc|ppc|paid|display)/.test(medium)
    );

    let acquisitionSource = "direct";
    if (paid) {
      acquisitionSource = "paid_search";
    } else if (/(^|\.)google\./.test(referrerHost) || source === "google") {
      acquisitionSource = "google_organic";
    } else if (
      /(^|\.)(bing\.com|search\.yahoo\.com|duckduckgo\.com)$/.test(referrerHost) ||
      /(bing|yahoo|duckduckgo)/.test(source)
    ) {
      acquisitionSource = "other_organic";
    } else if (referrerHost && referrerHost !== currentHost) {
      acquisitionSource = "referral";
    }

    const attribution = {
      acquisition_source: acquisitionSource,
      landing_path: `${landingUrl.pathname}${landingUrl.search}`.slice(0, 300),
      referrer_host: referrerHost.slice(0, 120),
      utm_source: (landingUrl.searchParams.get("utm_source") || "").slice(0, 80),
      utm_medium: (landingUrl.searchParams.get("utm_medium") || "").slice(0, 80),
      utm_campaign: (landingUrl.searchParams.get("utm_campaign") || "").slice(0, 100),
      ...Object.fromEntries(
        CLICK_ID_KEYS.map((key) => [key, cleanClickId(landingUrl.searchParams.get(key))])
      ),
      click_id_present: CLICK_ID_KEYS.some((key) => landingUrl.searchParams.get(key)),
    };
    window.sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
    return attribution;
  } catch {
    return { acquisition_source: "unknown", landing_path: window.location.pathname.slice(0, 300) };
  }
};

export const getLeadAnalyticsContext = (leadId = "") => {
  if (typeof window === "undefined") return {};
  let lastPartSearch = {};
  try {
    lastPartSearch = JSON.parse(window.sessionStorage.getItem(LAST_PART_SEARCH_KEY) || "{}");
  } catch {
    lastPartSearch = {};
  }
  return {
    leadId: leadId || createLeadId(),
    visitorId: storedId(window.localStorage, VISITOR_KEY),
    sessionId: storedId(window.sessionStorage, SESSION_KEY),
    sourcePage: `${window.location.pathname}${window.location.search}`.slice(0, 300),
    referrer: document.referrer.slice(0, 300),
    search_term: String(lastPartSearch.search_term || "").slice(0, 100),
    search_kind: String(lastPartSearch.search_kind || "").slice(0, 40),
    ...sessionAttribution(),
  };
};



export const trackWebsiteEvent = (eventType, properties = {}, options = {}) => {
  if (typeof window === "undefined") return;
  if (navigator.doNotTrack === "1") return;
  if (
    !shouldCollectBrowserAnalytics({
      hostname: window.location.hostname,
      userAgent: navigator.userAgent,
      webdriver: navigator.webdriver,
    })
  ) {
    return;
  }

  const attribution = sessionAttribution();
  const safeProperties = Object.fromEntries(
    Object.entries({ ...properties, ...attribution })
      .filter(([key]) => !CLICK_ID_KEYS.includes(key))
      .filter(([key]) => key !== "source")
      .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
      .slice(0, 20)
  );
  if (
    eventType === "search" &&
    safeProperties.search_location === "parts_catalog" &&
    safeProperties.search_term
  ) {
    try {
      window.sessionStorage.setItem(
        LAST_PART_SEARCH_KEY,
        JSON.stringify({
          search_term: safeProperties.search_term,
          search_kind: safeProperties.search_kind || "keyword",
        })
      );
    } catch {
      // Analytics must never interrupt catalog use.
    }
  }
  const payload = {
    eventType,
    path: `${window.location.pathname}${window.location.search}`.slice(0, 300),
    referrer: document.referrer.slice(0, 300),
    visitorId: storedId(window.localStorage, VISITOR_KEY),
    sessionId: storedId(window.sessionStorage, SESSION_KEY),
    occurredAt: new Date().toISOString(),
    properties: safeProperties,
  };

  if (options.recordInternally !== false) {
    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  }

  if (eventType !== "page_view" && typeof window.gtag === "function") {
    const gaProperties = {
      ...safeProperties,
      page_path: payload.path,
    };
    window.gtag("event", gaEventName(eventType), gaProperties);

    if (eventType === "form_submit") {
      const specificLeadEvent = getLeadEventName(safeProperties.form_type);
      if (specificLeadEvent) {
        window.gtag("event", specificLeadEvent, gaProperties);
      }
    }
  }
};

export const announceFormOpen = (formType, source = "", leadId = createLeadId()) => {
  trackWebsiteEvent("form_open", {
    form_type: formType,
    form_source: source,
    lead_id: leadId,
  });
  return leadId;
};
