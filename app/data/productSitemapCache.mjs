// One compact value and one refresh per process, including across route bundles.
export function createProductSitemapCache({ ttlMs = 3600000, retryMs = 60000, now = Date.now } = {}) {
  let value, expiresAt = 0, inFlight, retryAt = 0, lastError;
  return async function get(load) {
    if (value && now() < expiresAt) return value;
    if (inFlight) return inFlight;
    if (now() < retryAt) throw lastError;
    inFlight = Promise.resolve().then(load).then((entries) => {
      if (!Array.isArray(entries) || !entries.length) throw new Error("Product sitemap generation returned no public products.");
      value = Object.freeze(entries.map((entry) => Object.freeze(entry)));
      expiresAt = now() + ttlMs;
      retryAt = 0;
      return value;
    }).catch((error) => {
      lastError = error;
      retryAt = now() + retryMs;
      throw error;
    }).finally(() => { inFlight = undefined; });
    return inFlight;
  };
}

const key = Symbol.for("ais.product-sitemap-cache.v2");
export function sharedProductSitemapEntries(load) {
  globalThis[key] ||= createProductSitemapCache();
  return globalThis[key](load);
}
