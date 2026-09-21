export const MARKETING_CONSENT_KEY = "ais_marketing_measurement_consent";
export const MARKETING_CONSENT_EVENT = "ais:marketing-consent";
const MAX_AGE = 180 * 24 * 60 * 60_000;

export function marketingConsent({ storage, navigator = {}, now = Date.now() } = {}) {
  if (navigator.doNotTrack === "1" || navigator.globalPrivacyControl === true) return "denied";
  try {
    const value = JSON.parse(storage?.getItem(MARKETING_CONSENT_KEY) || "null");
    if (["granted", "denied"].includes(value?.status) && Number.isFinite(value.at) &&
        now >= value.at && now - value.at < MAX_AGE) return value.status;
  } catch { /* Unknown is not consent. */ }
  return "unknown";
}
