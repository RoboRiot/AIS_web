import { redactAnalyticsText } from "./analyticsPrivacy.mjs";

const FORM_TYPES = new Set([
  "contact_form",
  "part_request",
  "service_request",
  "trailer_request",
]);

const LEAD_EVENT_NAMES = Object.freeze({
  contact_form: "generate_contact_lead",
  part_request: "generate_part_lead",
  service_request: "generate_service_lead",
  trailer_request: "generate_trailer_lead",
});

const ACQUISITION_SOURCES = new Set([
  "direct",
  "google_organic",
  "other_organic",
  "paid_search",
  "referral",
  "unknown",
]);

const clean = (value, maxLength = 120) =>
  String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const cleanClickId = (value) => {
  const candidate = clean(value, 240);
  return /^[a-zA-Z0-9._~-]{6,240}$/.test(candidate) ? candidate : "";
};

export const normalizeLeadId = (value) => {
  const candidate = clean(value, 100).toLowerCase();
  return /^[a-z0-9][a-z0-9-]{7,99}$/.test(candidate) ? candidate : "";
};

export const normalizeFormType = (value) => {
  const candidate = clean(value, 40);
  return FORM_TYPES.has(candidate) ? candidate : "";
};

export const getLeadEventName = (formType) =>
  LEAD_EVENT_NAMES[normalizeFormType(formType)] || "";

export const normalizeLeadAnalytics = (value = {}) => {
  const analytics = value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
  const source = clean(analytics.acquisition_source, 40);
  const clickIds = {
    gclid: cleanClickId(analytics.gclid),
    gbraid: cleanClickId(analytics.gbraid),
    wbraid: cleanClickId(analytics.wbraid),
    msclkid: cleanClickId(analytics.msclkid),
  };

  return {
    leadId: normalizeLeadId(analytics.leadId),
    visitorId: clean(analytics.visitorId, 100),
    sessionId: clean(analytics.sessionId, 100),
    sourcePage: clean(analytics.sourcePage, 300),
    landingPath: clean(analytics.landing_path, 300),
    referrer: clean(analytics.referrer, 300),
    referrerHost: clean(analytics.referrer_host, 120),
    acquisitionSource: ACQUISITION_SOURCES.has(source) ? source : "unknown",
    utm: {
      source: clean(analytics.utm_source, 80),
      medium: clean(analytics.utm_medium, 80),
      campaign: clean(analytics.utm_campaign, 100),
    },
    clickIds,
    clickIdPresent: Boolean(
      analytics.click_id_present || Object.values(clickIds).some(Boolean)
    ),
    searchTerm: redactAnalyticsText(analytics.search_term, 100).toLowerCase(),
    searchKind: clean(analytics.search_kind, 40),
  };
};

export const getFormMilestone = (eventType) =>
  ["form_open", "form_start", "form_submit"].includes(eventType)
    ? eventType
    : "";

export const shouldTrackLeadConversion = (result) =>
  Boolean(result?.ok);
