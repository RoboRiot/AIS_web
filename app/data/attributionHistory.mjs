import { CLICK_ID_KEYS } from "./browserAttribution.mjs";
import { normalizeCampaignTags, ACQUISITION_SOURCES } from "./campaignAttribution.mjs";
import { redactAnalyticsText } from "./analyticsPrivacy.mjs";

export const ATTRIBUTION_HISTORY_KEY = "ais_attribution_history_v1";
export const ATTRIBUTION_RETENTION_MS = 30 * 24 * 60 * 60_000;

export function normalizeTouch(value, now = Date.now()) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const at = Number(value.at);
  if (!Number.isFinite(at) || at <= 0 || at > now || now - at >= ATTRIBUTION_RETENTION_MS) return null;
  const path = redactAnalyticsText(String(value.landing_path || "").split(/[?#]/)[0], 300);
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  const ids = Object.fromEntries(CLICK_ID_KEYS.map((key) => [key,
    /^[a-zA-Z0-9._~-]{6,240}$/.test(value[key] || "") ? value[key] : ""]));
  return { at, acquisition_source: ACQUISITION_SOURCES.has(value.acquisition_source)
    ? value.acquisition_source : "unknown", landing_path: path,
  ...normalizeCampaignTags(value), ...ids };
}

export function normalizeAttributionHistory(value, now = Date.now()) {
  if (value?.consent !== "granted") return { consent: "denied", firstTouch: null, lastPaidTouch: null };
  const paid = normalizeTouch(value.lastPaidTouch, now);
  return { consent: "granted", firstTouch: normalizeTouch(value.firstTouch, now),
    lastPaidTouch: paid?.acquisition_source === "paid_search" ? paid : null };
}

export function readAttributionHistory({ current, storage, allowed = false, now = Date.now() }) {
  if (!allowed) {
    try { storage?.removeItem(ATTRIBUTION_HISTORY_KEY); } catch { /* Storage is optional. */ }
    return normalizeAttributionHistory(null, now);
  }
  let previous;
  try { previous = JSON.parse(storage?.getItem(ATTRIBUTION_HISTORY_KEY) || "null"); } catch { /* Ignore invalid storage. */ }
  const history = normalizeAttributionHistory({ ...previous, consent: "granted" }, now);
  const touch = normalizeTouch({ ...current, at: now }, now);
  if (!history.firstTouch && touch) history.firstTouch = touch;
  // Do not extend the attribution window on every page view of the same paid visit.
  if (touch?.acquisition_source === "paid_search" && (!history.lastPaidTouch ||
    [...CLICK_ID_KEYS, "utm_campaign", "utm_id"].some((key) => touch[key] !== history.lastPaidTouch[key]))) {
    history.lastPaidTouch = touch;
  }
  try { storage?.setItem(ATTRIBUTION_HISTORY_KEY, JSON.stringify(history)); } catch { /* No durable attribution without storage. */ }
  return history;
}
