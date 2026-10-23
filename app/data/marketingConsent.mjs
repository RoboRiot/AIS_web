export const MARKETING_CONSENT_KEY = "ais_marketing_measurement_consent";
export const MARKETING_CONSENT_EVENT = "ais:marketing-consent";
export const DEFAULT_MARKETING_CONSENT = {
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
};
export const CONSENT_MAX_AGE = 180 * 24 * 60 * 60_000;

export function readMeasurementConsent({ storage, navigator = {}, choice, now = Date.now() } = {}) {
  if (navigator.doNotTrack === "1" || navigator.globalPrivacyControl === true) {
    return { advertising: "denied", analytics: "denied" };
  }
  try {
    const value = choice || JSON.parse(storage?.getItem(MARKETING_CONSENT_KEY) || "null");
    if (Number.isFinite(value?.at) && now >= value.at && now - value.at < CONSENT_MAX_AGE) {
      return {
        advertising: ["granted", "denied"].includes(value.status) ? value.status : "unknown",
        // The original notice covered advertising, not permission for GA cookies.
        analytics: ["granted", "denied"].includes(value.analyticsStatus) ? value.analyticsStatus : "unknown",
      };
    }
  } catch { /* Unknown is not consent. */ }
  return { advertising: "unknown", analytics: "unknown" };
}

export function marketingConsent(options) {
  return readMeasurementConsent(options).advertising;
}

export function browserMeasurementConsent(browser) {
  let storage;
  try { storage = browser.localStorage; } catch { /* Storage may be disabled. */ }
  return readMeasurementConsent({ storage, navigator: browser.navigator, choice: browser.__aisConsentChoice });
}

export function googleConsentState(consent) {
  return {
    ...DEFAULT_MARKETING_CONSENT,
    analytics_storage: consent.analytics === "granted" ? "granted" : "denied",
    ad_storage: consent.advertising === "granted" ? "granted" : "denied",
    ad_user_data: consent.advertising === "granted" ? "granted" : "denied",
  };
}

export function initializeGoogleConsent(browser) {
  browser.dataLayer = browser.dataLayer || [];
  browser.gtag = browser.gtag || function gtag() { browser.dataLayer.push(arguments); };
  const state = googleConsentState(browserMeasurementConsent(browser));
  if (!browser.__aisMarketingConsentInitialized) {
    browser.gtag("consent", "default", state);
    browser.__aisMarketingConsentInitialized = true;
    browser.__aisConsentSignature = JSON.stringify(state);
  }
  return state;
}

export function synchronizeGoogleConsent(browser) {
  initializeGoogleConsent(browser);
  const state = googleConsentState(browserMeasurementConsent(browser));
  const signature = JSON.stringify(state);
  if (browser.__aisConsentSignature !== signature) {
    browser.gtag("consent", "update", state);
    browser.__aisConsentSignature = signature;
  }
  return state;
}

export function saveMeasurementConsent(browser, { advertising, analytics }) {
  const choice = {
    status: advertising === "granted" ? "granted" : "denied",
    analyticsStatus: analytics === "granted" ? "granted" : "denied",
    at: Date.now(),
  };
  browser.__aisConsentChoice = choice;
  try { browser.localStorage.setItem(MARKETING_CONSENT_KEY, JSON.stringify(choice)); }
  catch { /* Apply this visit's choice even when it cannot be persisted. */ }
  try {
    if (choice.analyticsStatus !== "granted") {
      browser.localStorage.removeItem("ais_visitor_id");
      browser.sessionStorage?.removeItem("ais_session_id");
      browser.sessionStorage?.removeItem("ais_last_part_search");
    }
    if (choice.status !== "granted") {
      browser.sessionStorage?.removeItem("ais_session_attribution");
    }
  } catch { /* Optional measurement storage may be unavailable. */ }
  // Update before any consent listeners, measurement events, or route transition.
  return synchronizeGoogleConsent(browser);
}

// This function must remain self-contained so the production minifier cannot
// leave references to module-scoped names inside the serialized head script.
function consentBootstrap(browser, key, maxAge, defaults) {
  if (browser.__aisMarketingConsentInitialized) return;
  const state = { ...defaults };
  const navigator = browser.navigator || {};
  if (navigator.doNotTrack !== "1" && navigator.globalPrivacyControl !== true) {
    try {
      const value = browser.__aisConsentChoice || JSON.parse(browser.localStorage?.getItem(key) || "null");
      const now = Date.now();
      if (Number.isFinite(value?.at) && now >= value.at && now - value.at < maxAge) {
        state.ad_storage = state.ad_user_data = value.status === "granted" ? "granted" : "denied";
        state.analytics_storage = value.analyticsStatus === "granted" ? "granted" : "denied";
      }
    } catch { /* Unknown and inaccessible choices stay denied. */ }
  }
  browser.gtag("consent", "default", state);
  browser.__aisMarketingConsentInitialized = true;
  browser.__aisConsentSignature = JSON.stringify(state);
}

export const GOOGLE_CONSENT_BOOTSTRAP = `(${consentBootstrap.toString()})(w,${JSON.stringify(MARKETING_CONSENT_KEY)},${CONSENT_MAX_AGE},${JSON.stringify(DEFAULT_MARKETING_CONSENT)});`;
