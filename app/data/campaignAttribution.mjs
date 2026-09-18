import { redactAnalyticsText } from "./analyticsPrivacy.mjs";

export const UTM_LIMITS = Object.freeze({
  utm_source: 80, utm_medium: 80, utm_campaign: 100,
  utm_content: 100, utm_term: 100, utm_id: 100,
});
export const ACQUISITION_SOURCES = new Set([
  "direct", "google_organic", "other_organic", "paid_search", "referral",
  "organic_social", "paid_social", "email", "display", "offline", "outreach",
  "other_campaign", "unknown",
]);

export const normalizeCampaignTags = (value = {}) => Object.fromEntries(
  Object.entries(UTM_LIMITS).map(([key, limit]) => [key, redactAnalyticsText(value?.[key], limit)])
);

export function classifyAcquisition({ tags = {}, referrerHost = "", external = false, hasClickId = false }) {
  const source = (tags.utm_source || "").toLowerCase();
  const medium = (tags.utm_medium || "").toLowerCase();
  if (/^(paid_social|paidsocial|paid-social)$/.test(medium)) return "paid_social";
  if (/^(display|banner|cpm)$/.test(medium)) return "display";
  if (/^(email|e-mail)$/.test(medium)) return "email";
  if (/^(offline|qr|print)$/.test(medium)) return "offline";
  if (medium === "outreach") return "outreach";
  if (/^(social|organic_social|social-network|social-media)$/.test(medium)) return "organic_social";
  if (medium === "referral") return "referral";
  if (hasClickId || /^(cpc|ppc|paid|paid_search|paidsearch)$/.test(medium)) return "paid_search";
  if (source === "google" && (!medium || medium === "organic")) return "google_organic";
  if (/^(bing|yahoo|duckduckgo)$/.test(source) && (!medium || medium === "organic")) return "other_organic";
  if (Object.values(tags).some(Boolean)) return "other_campaign";
  if (!external) return "direct";
  if (/(^|\.)google\./.test(referrerHost)) return "google_organic";
  if (/(^|\.)(bing\.com|search\.yahoo\.com|duckduckgo\.com)$/.test(referrerHost)) return "other_organic";
  if (/(^|\.)(linkedin\.com|lnkd\.in|facebook\.com|instagram\.com|t\.co|twitter\.com|x\.com)$/.test(referrerHost)) return "organic_social";
  return "referral";
}

// Keep attribution outside the event-property cap, and never copy raw ad click IDs.
export function normalizeEventAttribution(payload, pathUrl) {
  const value = payload?.attribution && typeof payload.attribution === "object" && !Array.isArray(payload.attribution)
    ? payload.attribution : (payload?.properties || {});
  const tags = normalizeCampaignTags(Object.fromEntries(Object.keys(UTM_LIMITS).map((key) =>
    [key, value[key] || pathUrl.searchParams.get(key) || ""]
  )));
  let host = "";
  try { host = new URL(payload?.referrer || "").hostname.toLowerCase(); } catch { /* Direct visit. */ }
  const savedHost = String(value.referrer_host || "").toLowerCase();
  if (/^[a-z0-9.-]{1,120}$/.test(savedHost)) host = savedHost;
  const landing = String(value.landing_path || pathUrl.pathname).split(/[?#]/)[0];
  return {
    ...tags,
    acquisition_source: ACQUISITION_SOURCES.has(value.acquisition_source) ? value.acquisition_source :
      classifyAcquisition({ tags, referrerHost: host, external: Boolean(host && host !== pathUrl.hostname), hasClickId: value.click_id_present === true }),
    landing_path: landing.startsWith("/") && !landing.startsWith("//") ? landing.slice(0, 300) : pathUrl.pathname,
    referrer_host: host,
    click_id_present: value.click_id_present === true,
  };
}
