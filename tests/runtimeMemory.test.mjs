import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { LRUCache } = require("next/dist/server/lib/lru-cache");
const { setupFsCheck } = require("next/dist/server/lib/router-utils/filesystem");

test("Next memory backport stays pinned and counts cache keys", () => {
  assert.equal(require("../scripts/verify-runtime-memory-fixes.cjs")(), true);
  assert.equal(require("next/package.json").version, "15.5.29");
  const cache = new LRUCache(10, (value, key) => value.length + key.length);
  cache.set("long-key", "ab");
  cache.set("b", "c");
  assert.equal(cache.has("long-key"), false);
  assert.equal(cache.get("b"), "c");
  assert.equal(cache.currentSize, 2);
});

test("actual Next filesystem cache evicts unique misses within its byte budget", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "ais-memory-fixture-"));
  const write = async (name, data) => writeFile(path.join(dir, name), typeof data === "string" ? data : JSON.stringify(data));
  const originalSet = LRUCache.prototype.set;
  let routeCache;
  LRUCache.prototype.set = function (...args) {
    if (this.maxSize === 8 * 1024 * 1024 || this.maxSize === 1024 * 1024) routeCache = this;
    return originalSet.apply(this, args);
  };
  try {
    await mkdir(path.join(dir, ".next", "server"), { recursive: true });
    await mkdir(path.join(dir, ".next", "static"), { recursive: true });
    await mkdir(path.join(dir, "public"));
    await write("public/fixture.txt", "local test only");
    await write(".next/BUILD_ID", "local-memory-fixture");
    await write(".next/routes-manifest.json", { dataRoutes: [], dynamicRoutes: [], redirects: [], headers: [] });
    await write(".next/prerender-manifest.json", { routes: {}, dynamicRoutes: {}, notFoundRoutes: [] });
    await write(".next/server/pages-manifest.json", {});
    await write(".next/server/functions-config-manifest.json", { functions: {} });
    const checker = await setupFsCheck({ dir, dev: false, config: { distDir: ".next", basePath: "", experimental: {} } });
    for (let i = 0; i < 40000; i++) {
      assert.equal(await checker.getItem(`/missing-${i}-${"x".repeat(256)}`), null);
    }
    assert.ok(routeCache, "The real router cache was exercised");
    assert.equal(routeCache.maxSize, 8 * 1024 * 1024);
    assert.ok(routeCache.size < 22000, `Unbounded route count: ${routeCache.size}`);
    assert.ok(routeCache.currentSize <= 8 * 1024 * 1024);
    const asset = await checker.getItem("/fixture.txt");
    assert.equal(asset.type, "publicFolder");
    assert.equal(asset.itemPath, "/fixture.txt");
    assert.deepEqual(await checker.getItem("/fixture.txt"), asset);
  } finally {
    LRUCache.prototype.set = originalSet;
    await rm(dir, { recursive: true, force: true });
  }
});

test("middleware avoids the affected Edge sandbox without dropping its matcher", async () => {
  const source = await readFile(new URL("../middleware.js", import.meta.url), "utf8");
  assert.match(source, /runtime:\s*"nodejs"/);
  assert.match(source, /matcher:\s*\[/);
  assert.match(source, /guardRscDeployment/);
});

test("production memory telemetry contains only bounded process metrics", () => {
  const sample = require("../scripts/runtime-memory-telemetry.cjs").sampleMemory();
  assert.deepEqual(Object.keys(sample), ["type", "at", "pid", "uptimeSeconds", "rssBytes", "heapUsedBytes", "heapLimitBytes", "externalBytes", "arrayBuffersBytes"]);
  assert.equal(sample.type, "ais-runtime-memory");
  assert.ok(Number.isFinite(Date.parse(sample.at)));
  for (const key of Object.keys(sample).slice(2)) assert.ok(Number.isFinite(sample[key]) && sample[key] >= 0);
});
