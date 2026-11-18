const { getHeapStatistics } = require("node:v8");

function sampleMemory() {
  const usage = process.memoryUsage();
  return {
    type: "ais-runtime-memory",
    at: new Date().toISOString(),
    pid: process.pid,
    uptimeSeconds: Math.floor(process.uptime()),
    rssBytes: usage.rss,
    heapUsedBytes: usage.heapUsed,
    heapLimitBytes: getHeapStatistics().heap_size_limit,
    externalBytes: usage.external,
    arrayBuffersBytes: usage.arrayBuffers,
  };
}

// Process metrics only: no URLs, headers, environment, customer data or heap dump.
if (process.env.AIS_MEMORY_TELEMETRY === "1") {
  const report = () => console.log(JSON.stringify(sampleMemory()));
  report();
  setInterval(report, 60000).unref();
}

module.exports = { sampleMemory };
