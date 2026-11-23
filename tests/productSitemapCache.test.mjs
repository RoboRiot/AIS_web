import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { AsyncLocalStorage } from "node:async_hooks";
import { readFile } from "node:fs/promises";
import { createProductSitemapCache } from "../app/data/productSitemapCache.mjs";
import { buildProductSitemapEntries, buildProductSitemapEntriesFromPages } from "../app/data/productSitemap.mjs";

test("installed Next stale cache permits per-request refreshes, shared loader coalesces them", async () => {
  globalThis.AsyncLocalStorage ||= AsyncLocalStorage;
  const require = createRequire(import.meta.url);
  const { unstable_cache } = require("next/cache");
  const { workAsyncStorage } = require("next/dist/server/app-render/work-async-storage.external");
  const incrementalCache = {
    generateSimpleCacheKey: async () => "synthetic-key",
    get: async () => ({ isStale: true, value: { kind: "FETCH", data: { body: '[{"url":"old"}]' } } }),
    set: async () => {},
  };
  let calls = 0;
  const load = async () => { calls++; await new Promise((r) => setTimeout(r, 10)); return [{ url: "new" }]; };
  const cached = unstable_cache(load, ["synthetic-cache-test"], { revalidate: 3600 });
  await Promise.all(Array.from({ length: 84 }, (_, id) => workAsyncStorage.run({
    incrementalCache, route: `/synthetic-sitemap/${id}`, isRevalidate: true,
  }, () => cached())));
  assert.equal(calls, 84);
  calls = 0;
  const shared = createProductSitemapCache();
  await Promise.all(Array.from({ length: 84 }, () => shared(load)));
  assert.equal(calls, 1);
});

test("84 independent cold and expired shard requests share exactly one refresh", async () => {
  let time = 0, loads = 0;
  const get = createProductSitemapCache({ now: () => time, ttlMs: 1000 });
  const load = async () => { loads++; await new Promise((r) => setTimeout(r, 5)); return [{ url: "https://example.test/a" }]; };
  const first = await Promise.all(Array.from({ length: 84 }, () => get(load)));
  assert.equal(loads, 1);
  assert.ok(first.every((entries) => entries === first[0]));
  assert.ok(Object.isFrozen(first[0]) && Object.isFrozen(first[0][0]));
  time = 1001;
  const refreshed = await Promise.all(Array.from({ length: 84 }, () => get(load)));
  assert.equal(loads, 2);
  assert.notEqual(refreshed[0], first[0]);
});

test("failed or empty refresh is not cached and retry storms back off", async () => {
  let time = 0, calls = 0;
  const get = createProductSitemapCache({ now: () => time, ttlMs: 10, retryMs: 100 });
  const failing = async () => { calls++; throw new Error("offline"); };
  const results = await Promise.allSettled(Array.from({ length: 84 }, () => get(failing)));
  assert.ok(results.every((r) => r.status === "rejected"));
  assert.equal(calls, 1);
  await assert.rejects(get(failing), /offline/);
  assert.equal(calls, 1);
  time = 101;
  await assert.rejects(get(async () => []), /no public products/);
  time = 202;
  assert.equal((await get(async () => [{ url: "ok" }]))[0].url, "ok");
  time = 213;
  await assert.rejects(get(failing), /offline/);
});

test("paged sitemap projection preserves canonical sort/dedup/date behavior without retaining records", async () => {
  const products = Array.from({ length: 1001 }, (_, i) => ({
    id: String(i), Name: `Synthetic part ${i}`, PN: `${i}`, Description: "x".repeat(2048),
    UpdatedAt: "2026-11-23T00:00:00Z",
  }));
  async function* pages() { yield products.slice(0, 500); yield products.slice(500); yield products.slice(0, 2); }
  const result = await buildProductSitemapEntriesFromPages(pages());
  assert.deepEqual(result, buildProductSitemapEntries(products));
  assert.ok(result.every((entry) => Object.keys(entry).every((k) => ["url", "lastModified"].includes(k))));
});

test("both XML routes keep explicit hourly ISR after removing unstable_cache", async () => {
  for (const file of ["app/sitemap.xml/route.js", "app/sitemaps/products/sitemap.js"]) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(source, /export const revalidate = 3600;/);
  }
});
