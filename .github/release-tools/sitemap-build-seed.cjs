'use strict';
// Build-only public snapshot. Never packaged or enabled in the server runtime.
const fs = require('node:fs');
const assert = require('node:assert/strict');
assert.equal(process.env.AIS_BUILD_PUBLIC_SITEMAP_SEED, '1');
const rows = JSON.parse(fs.readFileSync(process.env.AIS_SITEMAP_ENTRIES, 'utf8'));
assert.equal(rows.length, 7983);
assert(rows.every(row => row.url.startsWith('https://advancedimagingparts.com/products/') &&
  Object.keys(row).every(key => ['url', 'lastModified'].includes(key))));
const entries = Object.freeze(rows.map(Object.freeze));
globalThis[Symbol.for('ais.product-sitemap-cache.v2')] = async () => entries;

// Seed the original cache key when Next computes it. Minified callback names
// change between builds, so a cache filename from an older build is not stable.
const path = require('node:path');
const Module = require('node:module');
const snapshot = JSON.parse(require('node:zlib').gunzipSync(fs.readFileSync(process.env.AIS_PUBLIC_SITEMAP)));
const seedValues = new Map([
  ['parts-relevant-catalog-v2', snapshot.parts[0].products],
  ['homepage-products-v2', { mostRequested: snapshot.home[0], ctTubes: snapshot.home[1] }],
]);
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  const loaded = originalLoad.apply(this, arguments);
  if (loaded?.IncrementalCache?.prototype?.generateCacheKey) {
    const prototype = loaded.IncrementalCache.prototype;
    if (!prototype.__aisPublicBuildSeed) {
      const original = prototype.generateCacheKey;
      prototype.generateCacheKey = async function(value, ...args) {
        const key = await original.call(this, value, ...args);
        for (const [marker, body] of seedValues) {
          if (typeof value === 'string' && value.includes(marker)) {
            const folder = path.resolve(process.env.AIS_NEXT_DIST_DIR, 'cache/fetch-cache');
            fs.mkdirSync(folder, { recursive: true });
            fs.writeFileSync(path.join(folder, key), JSON.stringify({kind:'FETCH',data:{headers:{},body:JSON.stringify(body),status:200,url:''},revalidate:900,tags:[]}));
          }
        }
        return key;
      };
      Object.defineProperty(prototype, '__aisPublicBuildSeed', { value: true });
    }
  }
  return loaded;
};
