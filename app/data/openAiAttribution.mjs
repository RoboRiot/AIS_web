import { normalizeOpenAiClickId } from "./openAiConversionsConfig.mjs";

export const OPENAI_ATTRIBUTION_KEY = "ais_openai_click_attribution";
export const OPENAI_ATTRIBUTION_MAX_AGE = 30 * 24 * 60 * 60_000;

// Kept separate from Google/internal event properties. Only the accepted-inquiry
// API receives this opaque reference, after the visitor permits advertising measurement.
export function createOpenAiAttributionReader() {
  let current;
  let observedIncoming;
  return ({ href, storage, allowed = false, now = Date.now() }) => {
    if (!allowed) {
      current = undefined;
      observedIncoming = undefined;
      try { storage?.removeItem(OPENAI_ATTRIBUTION_KEY); } catch { /* Restricted storage. */ }
      return "";
    }

    if (!current) {
      try { current = JSON.parse(storage?.getItem(OPENAI_ATTRIBUTION_KEY) || "null"); }
      catch { /* Keep a consented in-memory reference if storage is unavailable. */ }
    }
    const previousReference = normalizeOpenAiClickId(current?.oppref);
    if (!previousReference || !Number.isFinite(current?.at) ||
        now < current.at || now - current.at >= OPENAI_ATTRIBUTION_MAX_AGE) {
      current = undefined;
      try { storage?.removeItem(OPENAI_ATTRIBUTION_KEY); } catch { /* Restricted storage. */ }
    }

    let incoming = "";
    try { incoming = normalizeOpenAiClickId(new URL(href).searchParams.get("oppref")); }
    catch { /* Malformed URLs cannot establish ad attribution. */ }
    // Repeated events on an old landing page must not restart its 30-day age.
    const firstObservation = observedIncoming === undefined;
    const newReference = incoming && incoming !== observedIncoming;
    if (incoming) observedIncoming = incoming;
    if (newReference && incoming !== current?.oppref &&
        !(firstObservation && previousReference === incoming)) {
      current = { oppref: incoming, at: now };
      try { storage?.setItem(OPENAI_ATTRIBUTION_KEY, JSON.stringify(current)); }
      catch { /* Keep only the current visit's memory copy. */ }
    }
    return current?.oppref || "";
  };
}
