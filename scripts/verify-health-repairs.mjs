import assert from "node:assert/strict";
import { BUSINESS_PHONE_HREF, SUPPORT_PHONE_HREF } from "../app/data/businessContact.mjs";
import { serviceLandingPages, trailerLandingPages } from "../app/data/serviceLandingPages.js";

// Read-only HTTP checks. Never submit forms, create analytics events or call Google.
const base = new URL(process.argv[2] || "http://127.0.0.1:3096");
assert.ok(["127.0.0.1", "localhost", "advancedimagingparts.com"].includes(base.hostname));
const request = (path) => fetch(new URL(path, base), {
  redirect: "manual", headers: { "User-Agent": "AIS-Website-Health-Monitor/1.0" },
  signal: AbortSignal.timeout(30000),
});
const checks = [];
for (const [path, pn, id] of [
  ["/products/vct-64-center-digital-module-kit-sherlock-5136400-3", "5136400-3", "a761c231a605"],
  ["/products/kgtsm-px79-11217", "PX79-11217", "bd1b36a1ab69"],
]) {
  for (let pass = 0; pass < 2; pass++) {
    const response = await request(path);
    assert.equal(response.status, 308, `${path}: expected a permanent redirect`);
    const target = new URL(response.headers.get("location"), base);
    assert.match(target.pathname, /--id-/);
    const product = await request(target.pathname);
    assert.equal(product.status, 200, target.pathname);
    const html = await product.text();
    assert.ok(html.includes(pn), "matching part number must be visible");
    assert.ok(html.includes(`data-product-id="${id}"`), "matching catalog ID must be rendered");
    const data = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((match) => JSON.parse(match[1]));
    assert.ok(data.some((item) => item["@type"] === "WebPage"));
    assert.ok(data.some((item) => item["@type"] === "BreadcrumbList"));
    assert.ok(!data.some((item) => item["@type"] === "Product"));
    checks.push({ path, pass: pass ? "warm" : "cold", status: response.status, target: target.pathname, targetStatus: product.status });
  }
}
for (const path of ["/", "/about", "/contact", "/service-request", "/parts", "/parts/ge/mri", "/parts/toshiba/ct", "/services", "/trailers",
  ...serviceLandingPages.map(({ slug }) => `/services/${slug}`),
  ...trailerLandingPages.map(({ slug }) => `/trailers/${slug}`)]) {
  const response = await request(path);
  assert.equal(response.status, 200, path);
  const html = await response.text();
  assert.ok(html.includes(BUSINESS_PHONE_HREF), `${path}: approved business phone link must render`);
  assert.ok(html.includes(SUPPORT_PHONE_HREF), `${path}: existing-customer phone link must render`);
  assert.ok(html.includes("New Customers") && html.includes("Existing Customers"), `${path}: customer labels must render`);
  assert.ok(response.headers.get("content-security-policy").includes("https://*.google-analytics.com"));
  checks.push({ path, status: response.status, release: response.headers.get("x-ais-release") });
}
const unknown = await request("/products/ais-nonexistent-health-check-part");
assert.equal(unknown.status, 404, "unknown products must not become guessed redirects or soft 404s");
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), base: base.origin, checks, unknownProductStatus: unknown.status }, null, 2));
