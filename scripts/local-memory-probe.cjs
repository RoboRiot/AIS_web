// Local load-test instrumentation only; never preload into production.
if (!process.argv.includes("127.0.0.1")) throw new Error("Memory probe requires an explicit loopback server");
const { LRUCache } = require("next/dist/server/lib/lru-cache");
const { timeoutsManager, intervalsManager } = require("next/dist/server/web/sandbox/resource-managers");
const caches = [];
const seen = new WeakSet();
const originalSet = LRUCache.prototype.set;
LRUCache.prototype.set = function (...args) {
  if ([1024 * 1024, 8 * 1024 * 1024].includes(this.maxSize) && !seen.has(this)) {
    seen.add(this);
    caches.push(new WeakRef(this));
  }
  return originalSet.apply(this, args);
};
setInterval(() => {
  if (process.env.AIS_LOCAL_FORCE_GC === "1") global.gc?.();
  console.log(JSON.stringify({
    type: "local-memory", at: new Date().toISOString(), pid: process.pid,
    ...process.memoryUsage(),
    sandboxTimeouts: timeoutsManager.resources.length,
    sandboxIntervals: intervalsManager.resources.length,
    routerCaches: caches.map((ref) => ref.deref()).filter(Boolean)
      .map((cache) => ({ entries: cache.size, accountedBytes: cache.totalSize })),
  }));
}, 5000).unref();
