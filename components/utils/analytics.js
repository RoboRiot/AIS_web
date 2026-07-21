const VISITOR_KEY = "ais_visitor_id";
const SESSION_KEY = "ais_session_id";
const ATTRIBUTION_KEY = "ais_session_attribution";

const randomId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

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
      landingUrl.searchParams.get("gclid") ||
      landingUrl.searchParams.get("msclkid") ||
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
    };
    window.sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
    return attribution;
  } catch {
    return { acquisition_source: "unknown", landing_path: window.location.pathname.slice(0, 300) };
  }
};



export const trackWebsiteEvent = (eventType, properties = {}) => {
  if (typeof window === "undefined") return;
  if (navigator.doNotTrack === "1") return;

  const safeProperties = Object.fromEntries(
    Object.entries({ ...properties, ...sessionAttribution() })
      .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
      .slice(0, 20)
  );
  const payload = {
    eventType,
    path: `${window.location.pathname}${window.location.search}`.slice(0, 300),
    referrer: document.referrer.slice(0, 300),
    visitorId: storedId(window.localStorage, VISITOR_KEY),
    sessionId: storedId(window.sessionStorage, SESSION_KEY),
    occurredAt: new Date().toISOString(),
    properties: safeProperties,
  };

  fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});

  if (typeof window.gtag === "function") {
    window.gtag("event", gaEventName(eventType), {
      ...safeProperties,
      page_path: payload.path,
    });
  }
};

export const announceFormOpen = (formType, source = "") => {
  trackWebsiteEvent("form_open", { form_type: formType, source });
};
