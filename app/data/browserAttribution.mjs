export const CLICK_ID_KEYS = ["gclid", "gbraid", "wbraid", "msclkid"];
const SESSION_IDLE_MS = 30 * 60_000;
const STORAGE_KEY = "ais_session_attribution";

const clickId = (value) => /^[a-zA-Z0-9._~-]{6,240}$/.test(value || "") ? value : "";

export function resolveAttribution({ href, referrer = "", previous, entry = false, now = Date.now() }) {
  const url = new URL(href);
  let referrerHost = "";
  try { referrerHost = new URL(referrer).hostname.toLowerCase(); } catch { /* No valid referrer. */ }
  const external = referrerHost && referrerHost !== url.hostname.toLowerCase();
  const ids = Object.fromEntries(CLICK_ID_KEYS.map((key) => [key, clickId(url.searchParams.get(key))]));
  const source = (url.searchParams.get("utm_source") || "").slice(0, 80);
  const medium = (url.searchParams.get("utm_medium") || "").slice(0, 80);
  const campaign = (url.searchParams.get("utm_campaign") || "").slice(0, 100);
  const tagged = Object.values(ids).some(Boolean) || source || medium || campaign;
  const changedCampaign = tagged && (
    CLICK_ID_KEYS.some((key) => ids[key] !== (previous?.[key] || "")) ||
    source !== (previous?.utm_source || "") || medium !== (previous?.utm_medium || "") ||
    campaign !== (previous?.utm_campaign || "")
  );
  const age = now - Number(previous?.observed_at || now);
  if (previous?.acquisition_source && previous?.landing_path && age >= 0 && age < SESSION_IDLE_MS &&
      !changedCampaign && !(entry && external)) {
    return { ...previous, landing_path: String(previous.landing_path).split(/[?#]/)[0], observed_at: now };
  }

  let acquisitionSource = "direct";
  if (Object.values(ids).some(Boolean) || /(cpc|ppc|paid|display)/i.test(medium)) {
    acquisitionSource = "paid_search";
  } else if (/(^|\.)google\./.test(referrerHost) || source.toLowerCase() === "google") {
    acquisitionSource = "google_organic";
  } else if (/(^|\.)(bing\.com|search\.yahoo\.com|duckduckgo\.com)$/.test(referrerHost) ||
      /^(bing|yahoo|duckduckgo)$/i.test(source)) {
    acquisitionSource = "other_organic";
  } else if (external) {
    acquisitionSource = "referral";
  }
  return {
    acquisition_source: acquisitionSource,
    landing_path: url.pathname.slice(0, 300),
    referrer_host: referrerHost.slice(0, 120),
    utm_source: source, utm_medium: medium, utm_campaign: campaign,
    ...ids,
    click_id_present: Object.values(ids).some(Boolean),
    observed_at: now,
  };
}

// Memory fallback preserves attribution across client-side navigation when storage is unavailable.
export function createAttributionReader() {
  let current;
  let entry = true;
  return ({ href, referrer, storage, now }) => {
    if (!current) {
      try { current = JSON.parse(storage?.getItem(STORAGE_KEY) || "null"); } catch { /* Restricted storage. */ }
    }
    current = resolveAttribution({ href, referrer, previous: current, entry, now });
    entry = false;
    try { storage?.setItem(STORAGE_KEY, JSON.stringify(current)); } catch { /* Keep the memory copy. */ }
    const { observed_at, ...attribution } = current;
    return attribution;
  };
}
