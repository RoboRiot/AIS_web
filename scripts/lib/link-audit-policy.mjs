export const isTransient = (status) => status === 0 || status === 408 || status === 429 || status >= 500;

export class AvailabilityStop extends Error {
  constructor(url) { super(`Availability audit stopped at ${url}`); this.name = "AvailabilityStop"; }
}

// Stop on the first internal availability failure; do not amplify it with retries.
// External blocks and real 404s remain separate from site availability.
export function createAuditRequester({ fetchImpl = fetch, onAttempt = () => {} } = {}) {
  let stopped = false;
  const incidents = [];
  return {
    incidents,
    get recovered() { return false; },
    async request(url, { internal = true } = {}) {
      if (stopped) throw new AvailabilityStop(url);
      let result;
      const started = Date.now();
      try {
          const response = await fetchImpl(url, { signal: AbortSignal.timeout(30000), redirect: "follow", headers: { "user-agent": "AIS-ReadOnly-LinkAudit/2.0" } });
          const contentType = response.headers.get("content-type") || "";
          const readable = /text|xml|json/.test(contentType);
          const text = readable ? await response.text() : "";
          if (!readable) await response.body?.cancel();
          result = { status: response.status, finalUrl: response.url || url, contentType, text,
            release: response.headers.get("x-ais-release"), cachedAt: response.headers.get("x-ais-monitor-cached-at"), robotsHeader: response.headers.get("x-robots-tag"), ms: Date.now() - started, attempts: 1 };
      } catch (error) {
        result = { status: 0, finalUrl: url, contentType: "", text: "", error: error.message, ms: Date.now() - started, attempts: 1 };
      }
      onAttempt({ url, ...result, text: undefined });
      if (internal) {
        if (isTransient(result.status)) {
          stopped = true;
          incidents.push({ url, status: result.status, attempts: result.attempts, error: result.error });
        }
      }
      return result;
    },
  };
}

export function recordCheck(previous, result, at) {
  const verifiedAt = previous?.verifiedAt || (previous?.status && !isTransient(previous.status) ? previous.checkedAt : undefined);
  return { ...previous, attemptedAt: at, checkedAt: at, status: result.status, finalUrl: result.finalUrl,
    verifiedAt: isTransient(result.status) ? verifiedAt : at,
    healthyAt: result.status === 200 ? at : previous?.healthyAt };
}

export function oldestFirst(urls, state) {
  return [...urls].sort((a, b) => (state[a]?.attemptedAt || state[a]?.checkedAt || "").localeCompare(state[b]?.attemptedAt || state[b]?.checkedAt || "") || a.localeCompare(b));
}

export function publicInternalUrl(href, from, base) {
  let url;
  try { url = new URL(href, from); } catch { return null; }
  const origin = new URL(base);
  if (!/^https?:$/.test(url.protocol) || ![origin.hostname, `www.${origin.hostname}`].includes(url.hostname)) return null;
  if (/^\/(api|admin)(\/|$)/.test(url.pathname)) return null;
  url.hash = "";
  return new URL(`${url.pathname}${url.search}`, origin).href;
}
