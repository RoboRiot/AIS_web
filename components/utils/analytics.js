const VISITOR_KEY = "ais_visitor_id";
const SESSION_KEY = "ais_session_id";

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

export const trackWebsiteEvent = (eventType, properties = {}) => {
  if (typeof window === "undefined") return;
  if (navigator.doNotTrack === "1") return;

  const safeProperties = Object.fromEntries(
    Object.entries(properties)
      .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
      .slice(0, 16)
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
