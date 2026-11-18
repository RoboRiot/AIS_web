import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { verifiedLegacyProductRoutes } from "../app/data/verifiedLegacyProductRoutes.mjs";
import { verificationRequest } from "./lib/site-verification.mjs";
import { LEGACY_TRAILER_REDIRECTS } from "../app/data/seoRoutes.mjs";

// HTTP only: no browser tags, form submissions, database writes or lead events.
const base = new URL(process.argv[2] || "http://localhost:3096");
assert.ok(["127.0.0.1", "localhost", "advancedimagingparts.com"].includes(base.hostname));
const request = (path) => verificationRequest(new URL(path, base));
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
const additionalRedirects = [
  ...LEGACY_TRAILER_REDIRECTS.map(({ source, destination }) => [`${source}?utm_source=legacy-check`, destination, null]),
  ["/about-us?utm_source=legacy-check", "/about", null],
  ["/ct?utm_source=legacy-check", "/services/ct-service", null],
  ["/Parts?utm_source=legacy-check", "/parts", null],
  ["/product-category/ct-scanner?utm_source=legacy-check", "/parts", "CT"],
  ["/product-category/ct-scanner/page/4?utm_source=legacy-check", "/parts", "CT"],
  ["/product-category/cath-lab?utm_source=legacy-check", "/parts", "Cath Lab"],
  ["/product-category/cath-lab/page/4?utm_source=legacy-check", "/parts", "Cath Lab"],
  ["/sitemaps/products/sitemap.xml?utm_source=legacy-check", "/sitemap.xml", null],
];
for (const [source, pathname, modality] of additionalRedirects) {
  const response = await request(source);
  await response.arrayBuffer();
  assert.equal(response.status, 308, source);
  const target = new URL(response.headers.get("location"), base);
  assert.equal(target.origin, base.origin);
  assert.equal(target.pathname, pathname);
  assert.equal(target.searchParams.get("utm_source"), "legacy-check");
  if (modality) assert.equal(target.searchParams.get("modality"), modality);
  const destination = await request(`${target.pathname}${target.search}`);
  await destination.arrayBuffer();
  assert.equal(destination.status, 200, `${source}: target must not loop`);
}
const guarded404s = ["/products/power-brush-2189175", "/products/ais-nonexistent-health-check-part", "/parts/page/not-a-page",
  "/product-category/ct-scanner/page/0", "/product-category/ct-scanner/page/not-a-page",
  "/product-category/cath-lab/page/0", "/product-category/cath-lab/page/not-a-page",
  "/monster-design-studios-our-web-design-company"];
for (const source of guarded404s) {
  const response = await request(source);
  await response.arrayBuffer();
  assert.equal(response.status, 404, `${source}: must not redirect to an unrelated item`);
}
if (["127.0.0.1", "localhost"].includes(base.hostname)) {
  for (const [source, destination] of [["/Parts?utm_source=proxy-check", "/parts?utm_source=proxy-check"],
    ["/product-detail?MRI%20Coil%20123", "/products/mri-coil-123"]]) {
    // Node fetch ignores a supplied Host header; use the HTTP client for this proxy fixture.
    const response = await new Promise((resolve, reject) => {
      const request = httpRequest(new URL(source, base), { headers: {
        Host: "advancedimagingparts.com", "X-Forwarded-Proto": "https", "User-Agent": "AIS-Release-Verification/1.0",
      } }, response => { response.resume(); response.on("end", () => resolve(response)); });
      request.setTimeout(30000, () => request.destroy(new Error("Proxy-host verification timed out")));
      request.on("error", reject);
      request.end();
    });
    assert.equal(response.statusCode, 308);
    const target = new URL(response.headers.location, "https://advancedimagingparts.com");
    assert.equal(target.origin, "https://advancedimagingparts.com", "Internal origin escaped the reverse proxy");
    assert.equal(`${target.pathname}${target.search}`, destination);
  }
}
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), base: base.origin,
  productRedirects: verifiedLegacyProductRoutes.length, paginationRedirects: 3,
  additionalRedirects: additionalRedirects.length, guarded404s: guarded404s.length, checks }, null, 2));
