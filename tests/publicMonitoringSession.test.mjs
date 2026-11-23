import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { openMonitoringSession } from "../scripts/lib/public-monitoring-session.mjs";

const base = "https://advancedimagingparts.com";
async function fixture(run) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "ais-monitor-test-"));
  try { await run(directory); } finally { await fs.rm(directory, { recursive: true, force: true }); }
}
const xml = (release = "r1") => new Response("<urlset/>", { headers: { "content-type": "application/xml", "x-ais-release": release } });

test("cross-tool lock excludes overlap and releases cleanly", () => fixture(async (directory) => {
  const first = await openMonitoringSession({ base, directory });
  try { await assert.rejects(openMonitoringSession({ base, directory }), /already active/); }
  finally { await first.close(); }
  const next = await openMonitoringSession({ base, directory });
  await next.close();
}));

test("public requests are serial and spaced even when callers enqueue concurrently", () => fixture(async (directory) => {
  let time = 0, active = 0, peak = 0;
  const starts = [];
  const session = await openMonitoringSession({ base, directory, now: () => time, sleep: async (ms) => { time += ms; }, fetchImpl: async () => {
    starts.push(time); active++; peak = Math.max(peak, active);
    await Promise.resolve(); active--; return new Response("ok");
  } });
  try { await Promise.all(["/a", "/b", "/c"].map((p) => session.fetch(base + p))); }
  finally { await session.close(); }
  assert.deepEqual(starts, [0, 2000, 4000]); assert.equal(peak, 1);
}));

test("first 502 prevents queued requests and persists cooldown across scripts", () => fixture(async (directory) => {
  let calls = 0;
  const options = { base, directory, now: () => 1000, fetchImpl: async () => { calls++; return new Response("bad", { status: 502 }); } };
  const session = await openMonitoringSession(options);
  try {
    const result = await Promise.allSettled([session.fetch(base), session.fetch(base + "/b")]);
    assert.equal(result[0].value.status, 502); assert.equal(result[1].status, "rejected");
    assert.equal(calls, 1);
  } finally { await session.close(); }
  await assert.rejects(openMonitoringSession(options), /cooldown/);
}));

test("leaf evidence is reused only within TTL and the same freshly observed release", () => fixture(async (directory) => {
  let time = 0, calls = 0, release = "r1";
  const options = { base, directory, cacheMs: 10000, now: () => time, sleep: async (ms) => { time += ms; }, fetchImpl: async () => { calls++; return xml(release); } };
  for (let run = 0; run < 4; run++) {
    if (run === 2) release = "r2";
    if (run === 3) time += 10001;
    const session = await openMonitoringSession(options);
    try {
      await session.fetch(base + "/sitemap.xml");
      const response = await session.fetch(base + "/sitemaps/pages/sitemap.xml");
      assert.equal(Boolean(response.headers.get("x-ais-monitor-cached-at")), run === 1);
    } finally { await session.close(); }
  }
  assert.equal(calls, 7);
}));
