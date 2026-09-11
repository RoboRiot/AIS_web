import { analyticsPageUrl } from "./analyticsPrivacy.mjs";
import { getLeadEventName } from "./leadAnalytics.mjs";

export function ensureGoogleAnalytics(browser, measurementId) {
  browser.dataLayer = browser.dataLayer || [];
  browser.gtag = browser.gtag || function gtag() { browser.dataLayer.push(arguments); };
  if (browser.__aisGaMeasurementId !== measurementId) {
    browser.gtag("js", new Date());
    browser.gtag("config", measurementId, {
      anonymize_ip: true, send_page_view: false,
      page_location: analyticsPageUrl(browser.location.href),
    });
    browser.__aisGaMeasurementId = measurementId;
  }
  return browser.gtag;
}

const LEDGER_KEY = "ais_queued_lead_events";
const RETENTION_MS = 7 * 24 * 60 * 60_000;

export function createLeadEventDispatcher() {
  const queued = new Map();
  return ({ gtag, properties, storage, now = Date.now() }) => {
    const id = properties.lead_id;
    if (!id || !getLeadEventName(properties.form_type)) return false;
    try {
      for (const [key, timestamp] of JSON.parse(storage?.getItem(LEDGER_KEY) || "[]")) {
        if (Number.isFinite(timestamp) && now - timestamp < RETENTION_MS) queued.set(key, timestamp);
      }
    } catch { /* Memory deduplication still works when storage is restricted. */ }
    if (queued.has(id)) return false;
    // An accepted duplicate response can recover a lost first response. Deduplicate by lead, not HTTP attempt.
    gtag("event", "generate_lead", properties);
    queued.set(id, now);
    try {
      storage?.setItem(LEDGER_KEY, JSON.stringify([...queued].filter(([, time]) => now - time < RETENTION_MS).slice(-200)));
    } catch { /* Queued is not a claim of receipt by Google. */ }
    gtag("event", getLeadEventName(properties.form_type), properties);
    return true;
  };
}
