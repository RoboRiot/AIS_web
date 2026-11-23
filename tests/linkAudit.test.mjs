import test from "node:test";
import assert from "node:assert/strict";
import { auditPublicLinks } from "../scripts/audit-public-links.mjs";
import { AvailabilityStop, createAuditRequester, oldestFirst, recordCheck } from "../scripts/lib/link-audit-policy.mjs";

const base = "https://advancedimagingparts.com";
const noSleep = async () => {};
const response = (status, text = "", type = "text/html") => new Response(text, { status, headers: { "content-type": type } });
const sitemap = (...paths) => `<urlset>${paths.map((p) => `<url><loc>${base}${p}</loc></url>`).join("")}</urlset>`;
const page = (p, links = "") => `<html><head><link rel="canonical" href="${base}${p}"></head><body><h1>AIS</h1>${links}</body></html>`;

test("first transient failure stops further requests without a retry", async () => {
  let calls = 0;
  const client = createAuditRequester({ fetchImpl: async () => { calls++; return response(502); }, sleep: noSleep });
  assert.equal((await client.request(`${base}/0`)).status, 502);
  await assert.rejects(client.request(`${base}/4`), AvailabilityStop);
  assert.equal(calls, 1);
  assert.equal(client.incidents.length, 1);
});

test("404s and external blocks do not trip the internal circuit", async () => {
  const statuses = [200, 404, 503, 200];
  const client = createAuditRequester({ fetchImpl: async () => response(statuses.shift()), sleep: noSleep });
  assert.equal((await client.request(base)).attempts, 1);
  assert.equal((await client.request(`${base}/missing`)).status, 404);
  await client.request("https://external.example", { internal: false });
  assert.equal((await client.request(base)).status, 200);
  assert.equal(client.incidents.length, 0);
});

test("failed attempts do not masquerade as verified coverage", () => {
  const old = { checkedAt: "2026-11-01", status: 502 };
  assert.equal(recordCheck(old, { status: 502 }, "2026-11-18").verifiedAt, undefined);
  const healthy = { checkedAt: "2026-11-01", status: 200 };
  assert.equal(recordCheck(healthy, { status: 502 }, "2026-11-18").verifiedAt, "2026-11-01");
  assert.deepEqual(oldestFirst(["b", "a"], { a: { attemptedAt: "2026-11-18" } }), ["b", "a"]);
});

test("non-sitemap product discoveries persist and are checked on the next run", async () => {
  const fakeFetch = async (url) => url.endsWith("/sitemap.xml") ? response(200, sitemap("/", "/products/a"), "application/xml")
    : url.endsWith("/robots.txt") ? response(200, "User-agent: *", "text/plain")
    : response(200, page(new URL(url).pathname, '<a href="/products/z">Part</a><a href="/api/delete">Never</a>'));
  const first = await auditPublicLinks({ fetchImpl: fakeFetch, sleep: noSleep, batchSize: 1 });
  assert.equal(first.report.complete, true);
  assert.equal(first.state[`${base}/products/z`].attemptedAt, undefined);
  assert.ok(first.state[`${base}/products/z`].discoveredAt);
  assert.equal(first.state[`${base}/api/delete`], undefined);
  const second = await auditPublicLinks({ fetchImpl: fakeFetch, sleep: noSleep, batchSize: 1, previous: first.state });
  assert.ok(second.state[`${base}/products/z`].verifiedAt);
  assert.equal(second.report.coverage.productsThisRun, 1);
});

test("partial sitemap discovery preserves the prior queue and emits an incomplete report", async () => {
  const previous = { [`${base}/products/old`]: { checkedAt: "2026-11-01", status: 200 } };
  const result = await auditPublicLinks({ previous, fetchImpl: async () => response(502), sleep: noSleep });
  assert.equal(result.report.complete, false);
  assert.equal(result.report.coverage.sitemapDiscoveryComplete, false);
  assert.deepEqual(result.state[`${base}/products/old`], previous[`${base}/products/old`]);
  assert.equal(result.report.coverage.productsThisRun, 0);
  assert.ok(result.report.issues.some((i) => i.type === "availability-incident"));
});

test("outage stops bounded work and never advances unattempted products", async () => {
  const result = await auditPublicLinks({ sleep: noSleep, fetchImpl: async (url) => url.endsWith("sitemap.xml")
    ? response(200, sitemap("/products/a", "/products/b", "/products/c", "/products/d"), "application/xml") : response(502) });
  assert.equal(result.report.complete, false);
  assert.equal(result.report.coverage.productsThisRun, 1);
  assert.equal(result.report.coverage.productsVerifiedThisRun, 0);
  assert.equal(result.state[`${base}/products/d`].attemptedAt, undefined);
  assert.equal(result.report.issues.filter((i) => i.type === "http").length, 0);
  assert.equal(result.report.issues.filter((i) => i.type === "availability-incident").length, 1);
});

test("a real 404 remains a link issue rather than an outage", async () => {
  const result = await auditPublicLinks({ sleep: noSleep, fetchImpl: async (url) => url.endsWith("sitemap.xml")
    ? response(200, sitemap("/products/missing"), "application/xml") : response(url.endsWith("robots.txt") ? 200 : 404) });
  assert.ok(result.report.issues.some((i) => i.type === "http" && i.status === 404));
  assert.ok(!result.report.issues.some((i) => i.type === "availability-incident"));
});
