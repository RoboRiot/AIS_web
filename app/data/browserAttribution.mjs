import { classifyAcquisition, normalizeCampaignTags, UTM_LIMITS } from "./campaignAttribution.mjs";

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
  const tags = normalizeCampaignTags(Object.fromEntries(Object.keys(UTM_LIMITS).map((key) => [key, url.searchParams.get(key)])));
  const tagged = Object.values(ids).some(Boolean) || Object.values(tags).some(Boolean);
  const changedCampaign = tagged && (
    CLICK_ID_KEYS.some((key) => ids[key] !== (previous?.[key] || "")) ||
    Object.entries(tags).some(([key, value]) => value !== (previous?.[key] || ""))
  );
  const age = now - Number(previous?.observed_at || now);
  if (previous?.acquisition_source && previous?.landing_path && age >= 0 && age < SESSION_IDLE_MS &&
      !changedCampaign && !(entry && external)) {
    return { ...previous, landing_path: String(previous.landing_path).split(/[?#]/)[0], observed_at: now };
  }

  const acquisitionSource = classifyAcquisition({ tags, referrerHost, external, hasClickId: Object.values(ids).some(Boolean) });
  return {
    acquisition_source: acquisitionSource,
    landing_path: url.pathname.slice(0, 300),
    referrer_host: referrerHost.slice(0, 120),
    ...tags,
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
