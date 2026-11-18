import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { verifySiteAssets } from "./verify-site-assets.mjs";

const [baseUrl, expectedRelease, reportPath] = process.argv.slice(2);
assert.ok(baseUrl && expectedRelease, "Usage: node scripts/verify-release.mjs BASE_URL EXPECTED_RELEASE [REPORT.json]");
const base = new URL(baseUrl);
assert.ok(["localhost", "127.0.0.1", "advancedimagingparts.com"].includes(base.hostname));
async function assertRelease() {
  const response = await fetch(base, { redirect: "manual", signal: AbortSignal.timeout(30000), headers: { "User-Agent": "AIS-Release-Verification/1.0" } });
  await response.arrayBuffer();
  assert.equal(response.status, 200, "Homepage must respond without a redirect");
  assert.equal(response.headers.get("x-ais-release"), expectedRelease, "Wrong deployed release; a local build or push is not deployment proof");
}
await assertRelease();
for (const script of ["verify-legacy-product-redirects.mjs", "verify-health-repairs.mjs", "verify-sitemaps.mjs"]) {
  const child = spawnSync(process.execPath, [`scripts/${script}`, base.origin], {
    stdio: "inherit", env: { ...process.env, AIS_EXPECTED_RELEASE: expectedRelease },
  });
  if (child.error) throw child.error;
  assert.equal(child.status, 0, `${script} failed; do not call this release verified`);
}
const assets = await verifySiteAssets({ baseUrl: base.origin, concurrency: 1, maxProductPages: 40 });
assert.equal(assets.pageFailures.length, 0, "Page failures");
assert.equal(assets.assetFailures.length, 0, "Asset failures");
assert.deepEqual(assets.releases, [expectedRelease], "Mixed releases encountered during verification");
await assertRelease();
const report = { checkedAt: new Date().toISOString(), base: base.origin, expectedRelease,
  httpVerified: true, pages: assets.pageResults.length, resources: assets.resourceResults.length,
  browserVerified: false, leadDeliveryVerified: false,
  scope: "HTTP regression gate only. Desktop/mobile browser verification is additionally required. No form submission or call was made." };
if (reportPath) await writeFile(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
