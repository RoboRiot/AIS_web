import { shouldCollectBrowserAnalytics } from "./analyticsPolicy.mjs";

const enums = {
  eligibility: ["eligible", "privacy_opt_out", "excluded_environment", "unknown"],
  tagState: ["not_initialized", "queued", "loaded", "failed", "unknown"],
  marketingConsent: ["granted", "denied", "unknown"],
};

// Operational context on an accepted inquiry only; never includes cookies, IDs or URLs.
export function normalizeLeadMeasurement(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(Object.entries(enums).map(([key, allowed]) =>
    [key, allowed.includes(input[key]) ? input[key] : "unknown"]));
}

export function getLeadMeasurement({ browser, navigator = {}, consent = "unknown" }) {
  const optedOut = navigator.doNotTrack === "1" || navigator.globalPrivacyControl === true;
  const eligible = shouldCollectBrowserAnalytics({ hostname: browser?.location?.hostname,
    userAgent: navigator.userAgent, webdriver: navigator.webdriver });
  return normalizeLeadMeasurement({
    eligibility: optedOut ? "privacy_opt_out" : eligible ? "eligible" : "excluded_environment",
    marketingConsent: optedOut ? "denied" : consent,
    tagState: optedOut || !eligible ? "not_initialized" : browser?.__aisGoogleTagState ||
      (browser?.__aisGaMeasurementId ? "queued" : "not_initialized"),
  });
}

export function buildLeadDeliveryReport(events) {
  const accepted = new Map(), signals = new Map();
  for (const event of events) {
    const id = event.properties?.lead_id;
    if (typeof id !== "string" || !/^[a-z0-9-]{8,100}$/.test(id)) continue;
    if (event.eventType === "form_submit" && event.id === `lead-${id}` &&
        ["lead_api", "service_request_api"].includes(event.properties?.confirmed_by)) {
      accepted.set(id, event);
    }
    if (!["lead_event_queued", "lead_tag_processed"].includes(event.eventType)) continue;
    if (!signals.has(id)) signals.set(id, { queued: 0, processed: 0 });
    signals.get(id)[event.eventType === "lead_event_queued" ? "queued" : "processed"]++;
  }
  const leads = [...accepted].map(([leadId, event]) => {
    const signal = signals.get(leadId) || { queued: 0, processed: 0 };
    const measurement = normalizeLeadMeasurement(event.measurement);
    const status = signal.processed ? "tag_processed_receipt_unverified" : signal.queued ? "queued_receipt_unverified" :
      measurement.eligibility === "privacy_opt_out" ? "privacy_opt_out" :
      measurement.eligibility === "excluded_environment" ? "excluded_environment" :
      measurement.tagState === "failed" ? "script_load_failed" :
      measurement.eligibility === "unknown" ? "legacy_or_unknown" : "missing_browser_diagnostic";
    return { leadId, date: event.date, measurement, status,
      queuedSignals: signal.queued, processedSignals: signal.processed };
  });
  return {
    accepted: leads.length,
    queued: leads.filter((lead) => lead.queuedSignals).length,
    tagProcessed: leads.filter((lead) => lead.processedSignals).length,
    noBrowserDiagnostic: leads.filter((lead) => !lead.queuedSignals && !lead.processedSignals).length,
    duplicateDiagnosticLeads: leads.filter((lead) => lead.queuedSignals > 1 || lead.processedSignals > 1).length,
    note: "Browser context is client-reported at submission. Queued/processed does not prove GA receipt or Ads attribution. Legacy missing signals have an unknown cause; date boundaries can exclude later diagnostics.",
    leads,
  };
}
