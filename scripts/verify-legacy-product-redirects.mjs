import assert from "node:assert/strict";
import { verifiedLegacyProductRoutes } from "../app/data/verifiedLegacyProductRoutes.mjs";

// HTTP only: no browser tags, form submissions, database writes or lead events.
const base = new URL(process.argv[2] || "http://127.0.0.1:3096");
assert.ok(["127.0.0.1", "localhost", "advancedimagingparts.com"].includes(base.hostname));
const request = (path) => fetch(new URL(path, base), {
  redirect: "manual", headers: { "User-Agent": "AIS-Website-Health-Monitor/1.0" },
  signal: AbortSignal.timeout(45000),
});
const checks = [];
for (const route of verifiedLegacyProductRoutes) {
  const source = `/products/${route.slug}`;
  for (const pass of ["cold", "warm"]) {
    const response = await request(source);
    await response.arrayBuffer();
    assert.equal(response.status, 308, source);
    assert.ok(response.headers.get("location"), `${source}: missing Location`);
    const target = new URL(response.headers.get("location"), base);
    assert.equal(target.origin, base.origin);
    assert.match(target.pathname, /--id-/);
    const destination = await request(target.pathname);
    const html = await destination.text();
    assert.equal(destination.status, 200, target.pathname);
    assert.ok(html.includes(`data-product-id="${route.id}"`), source);
    assert.ok(html.includes(route.partNumber), source);
    checks.push({ source, pass, target: target.pathname, status: 308, targetStatus: 200,
      release: destination.headers.get("x-ais-release") });
  }
}
for (const page of ["1", "7", "28"]) {
  const response = await request(`/parts/page/${page}?utm_source=legacy-check`);
  await response.arrayBuffer();
  assert.equal(response.status, 308);
  const target = new URL(response.headers.get("location"), base);
  assert.equal(target.pathname, "/parts");
  assert.equal(target.searchParams.get("utm_source"), "legacy-check");
}
for (const source of ["/products/power-brush-2189175", "/products/ais-nonexistent-health-check-part", "/parts/page/not-a-page"]) {
  const response = await request(source);
  await response.arrayBuffer();
  assert.equal(response.status, 404, `${source}: must not redirect to an unrelated item`);
}
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), base: base.origin,
  productRedirects: verifiedLegacyProductRoutes.length, paginationRedirects: 3, guarded404s: 3, checks }, null, 2));
