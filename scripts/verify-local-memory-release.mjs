import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs/promises";
import path from "node:path";
import { createServer } from "node:net";
import { readSitemapTree } from "./verify-sitemaps.mjs";

const [release, outputDirectory] = process.argv.slice(2);
assert.ok(release && outputDirectory, "Usage: verify-local-memory-release.mjs RELEASE OUTPUT_DIRECTORY");
assert.match(release, /^[a-zA-Z0-9-]+$/, "Expected a local immutable release ID");
await fs.mkdir(outputDirectory, { recursive: true });
const expiredSitemaps = process.argv.includes("--expired-sitemaps");
let agedSitemapCount = 0;
if (expiredSitemaps) {
  // Only local generated cache metadata is aged, never source or live endpoints.
  const dist = path.resolve(".next-releases", release);
  const manifest = JSON.parse(await fs.readFile(path.join(dist, "prerender-manifest.json"), "utf8"));
  const old = Date.now() - 7200000;
  for (const route of Object.keys(manifest.routes)) {
    if (!route.endsWith(".xml") || !route.includes("sitemap")) continue;
    assert.ok(!route.includes(".."));
    const file = path.join(dist, "server/app", route.slice(1));
    const meta = JSON.parse(await fs.readFile(`${file}.meta`, "utf8"));
    meta.routeCacheLastModified = old;
    await fs.writeFile(`${file}.meta`, JSON.stringify(meta));
    await fs.utimes(`${file}.body`, new Date(old), new Date(old));
    agedSitemapCount++;
  }
  assert.ok(agedSitemapCount >= 80, "Missing local sitemap fixtures");
}
const reservation = createServer();
reservation.listen(0, "127.0.0.1");
await once(reservation, "listening");
const port = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
const base = `http://localhost:${port}`;
const child = spawn(process.execPath, ["--max-old-space-size=320", "--require", "./tests/fixtures/memory-preview-telemetry.cjs",
  "node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)], {
  env: { ...process.env, NODE_ENV: "production" }, stdio: ["ignore", "pipe", "pipe"],
});
const closed = once(child, "close");
const samples = [];
let buffer = "", fatalErrors = 0;
child.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  const lines = buffer.split("\n"); buffer = lines.pop();
  for (const line of lines) {
    if (!line.startsWith('{"type":"ais-runtime-memory"')) continue;
    samples.push(JSON.parse(line));
  }
});
child.stderr.on("data", (chunk) => {
  if (/FATAL ERROR|heap out of memory|ENOMEM/i.test(chunk.toString())) fatalErrors++;
});
const read = async (pathname) => {
  const response = await fetch(new URL(pathname, base), { signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, pathname);
  assert.equal(response.headers.get("x-ais-release"), release);
  return response.text();
};
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    assert.equal(child.exitCode, null, "Preview exited during startup");
    try { await read("/"); ready = true; break; } catch { await new Promise((r) => setTimeout(r, 500)); }
  }
  assert.ok(ready, "Preview did not become ready");
  const verifier = spawn(process.execPath, ["scripts/verify-release.mjs", base, release, `${outputDirectory}/http.json`], { stdio: "inherit" });
  const [status] = await once(verifier, "close");
  assert.equal(status, 0, "Local full HTTP regression failed");
  for (let wave = 0; wave < 3; wave++) {
    await readSitemapTree(read);
    for (const route of ["/parts/ge/mri", "/parts/siemens/ct", "/parts/toshiba/ct", "/parts/philips/mri", "/parts/philips/ct"]) await read(route);
  }
  await new Promise((r) => setTimeout(r, 1200));
  assert.ok(samples.length > 0, "Missing runtime samples");
  assert.equal(child.exitCode, null, "Preview exited unexpectedly");
  assert.equal(fatalErrors, 0);
  const peakRssBytes = Math.max(...samples.map((s) => s.rssBytes));
  assert.ok(peakRssBytes < 400 * 1024 * 1024, `Preview RSS exceeds candidate budget: ${peakRssBytes}`);
  const report = { at: new Date().toISOString(), base, release, platform: process.platform, nodeVersion: process.version,
    expiredSitemaps, agedSitemapCount,
    heapOldSpaceMiB: 320, peakRssBytes, peakHeapBytes: Math.max(...samples.map((s) => s.heapUsedBytes)),
    sampleCount: samples.length, fatalErrors, repeatedSitemapPasses: 3, processRestarts: 0,
    limitation: "Local Windows full-app HTTP check. Not a Linux 1 GiB capacity test, long-term soak, browser acceptance, or proof of lead delivery.", samples };
  await fs.writeFile(`${outputDirectory}/memory.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, samples: undefined }, null, 2));
} finally {
  // This handle belongs only to the child started above, never a server found by port.
  if (child.exitCode === null) child.kill();
  await closed;
}
