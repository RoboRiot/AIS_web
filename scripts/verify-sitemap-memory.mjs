import assert from "node:assert/strict";
import { createProductSitemapCache } from "../app/data/productSitemapCache.mjs";
import { buildProductSitemapEntriesFromPages, getProductSitemapPage } from "../app/data/productSitemap.mjs";

// Synthetic, local-only stress fixture. Never contacts Firebase or the website.
let time = 0, scans = 0, peakRss = 0, peakHeap = 0;
const sample = () => {
  const usage = process.memoryUsage();
  peakRss = Math.max(peakRss, usage.rss);
  peakHeap = Math.max(peakHeap, usage.heapUsed);
};
const get = createProductSitemapCache({ now: () => time, ttlMs: 1000 });
async function* pages() {
  scans++;
  for (let start = 0; start < 8000; start += 500) {
    const batch = Array.from({ length: 500 }, (_, index) => {
      const id = String(start + index);
      return { id, Name: `Synthetic MRI part ${id}`, PN: `TEST-${id}`,
        Description: Array.from({ length: 128 }, (_, n) => `${id}:${n}:synthetic`).join(" "),
        Images: [`https://example.invalid/${id}.png`], UpdatedAt: "2026-11-23T00:00:00Z" };
    });
    sample();
    yield batch;
    await new Promise((resolve) => setImmediate(resolve));
  }
}
for (let wave = 0; wave < 40; wave++) {
  time += 1001;
  const results = await Promise.all(Array.from({ length: 84 }, async (_, shard) => {
    const entries = await get(() => buildProductSitemapEntriesFromPages(pages()));
    assert.equal(entries.length, 8000);
    sample();
    return getProductSitemapPage(entries, shard % 80);
  }));
  assert.ok(results.every((page) => page.length === 100));
}
assert.equal(scans, 40);
assert.ok(peakRss < 350 * 1024 * 1024, `Synthetic RSS exceeded fixture budget: ${peakRss}`);
console.log(JSON.stringify({ synthetic: true, productionTraffic: false, waves: 40,
  concurrentShardCallsPerWave: 84, catalogSize: 8000, catalogScans: scans,
  peakRssBytes: peakRss, peakHeapBytes: peakHeap,
  limitation: "Tests the shared sitemap data path, not the full Linux/Next application or production catalog." }, null, 2));
