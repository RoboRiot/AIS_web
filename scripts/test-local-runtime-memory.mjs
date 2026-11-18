import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

const base = new URL(process.argv[2] || "http://127.0.0.1:3098");
assert.equal(base.hostname, "127.0.0.1", "Load testing is restricted to loopback");
const count = Number(process.argv[3] || 10000);
assert.ok(Number.isSafeInteger(count) && count > 0 && count <= 100000);
const headers = { "user-agent": "Mozilla/5.0 AIS local-only memory regression" };
const statuses = {};
const started = Date.now();
for (let i = 0; i < count; i++) {
  const route = i % 5 === 0 ? "/contact" : `/__ais_memory_probe/missing-${i}`;
  const url = new URL(route, base);
  url.searchParams.set("local_fixture", "x".repeat(1024));
  const response = await fetch(url, { headers, redirect: "manual", signal: AbortSignal.timeout(30000) });
  await response.arrayBuffer();
  const expected = i % 5 === 0 ? 200 : 404;
  assert.equal(response.status, expected, `${route} returned an unexpected status`);
  statuses[response.status] = (statuses[response.status] || 0) + 1;
  if ((i + 1) % 1000 === 0) console.log(JSON.stringify({ completed: i + 1, seconds: (Date.now() - started) / 1000, statuses }));
}
await delay(6000);
console.log(JSON.stringify({ complete: true, count, seconds: (Date.now() - started) / 1000, statuses }));
