import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const base = process.env.AIS_VERIFY_URL || "http://localhost:3091";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Run this check against a local production build only.");
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const legacyPaths = [
  "/products/center-3-8-dia-scissors-upper-ends-46-265887p2-sc9a6057f984d1",
  "/products/switch-touch-strip-tilt-handle-4351248-sc8bc44ba9c134",
  "/products/top-cover-side-right-assembly-positioning-gt-5127468-2-h--id-5343393639454243463938453539",
];

for (const oldPath of legacyPaths) {
  for (let pass = 0; pass < 2; pass++) {
    const response = await fetch(`${base}${oldPath}`, { redirect: "manual", headers: { "User-Agent": userAgent } });
    assert.equal(response.status, 308, oldPath);
    const location = response.headers.get("location");
    assert.ok(location, `Missing Location: ${oldPath}`);
    const target = new URL(location, base);
    const canonical = await fetch(`${base}${target.pathname}`, { redirect: "manual", headers: { "User-Agent": userAgent } });
    assert.equal(canonical.status, 200, target.pathname);
    console.log(`Redirect ${pass ? "warm" : "cold"}: 308 -> 200 ${oldPath}`);
  }
}

const outDir = path.resolve(process.env.AIS_VERIFY_OUTPUT || ".tmp/performance-verification");
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || "chrome" });
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, userAgent });
    // Block live analytics, inbox writes, and third-party tracking in all test pages.
    await context.route("**/api/lead", (route) => route.fulfill({ status: 500, json: { error: "Unmocked lead request in test" } }));
    await context.route("**/api/service-requests", (route) => route.abort());
    await context.route("**/api/analytics", (route) => route.fulfill({ json: { ok: true } }));
    await context.route(/https:\/\/(www\.google\.com|www\.googletagmanager\.com|.*google-analytics\.com|.*hubspot.*|.*hs-scripts.*)\//, (route) => route.abort());
    await context.addInitScript(() => {
      window.grecaptcha = { ready: (cb) => cb(), execute: async () => `test-token-${Date.now()}` };
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const route of ["/", "/contact", "/parts", "/trailers/mobile-ct-trailer-rental", "/trailers/mobile-mri-trailer-rental", "/services/mri-service"]) {
      const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
      assert.equal(response.status(), 200, route);
      const visibleH1 = await page.locator("h1:visible").count();
      assert.equal(visibleH1, 1, `Expected one visible H1: ${route}`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `Horizontal overflow: ${route} at ${width}`);
      const name = route === "/" ? "home" : route.replaceAll("/", "-").slice(1);
      await page.screenshot({ path: path.join(outDir, `${name}-${width}.png`), fullPage: true });
      await page.screenshot({ path: path.join(outDir, `${name}-${width}-viewport.png`) });
      if (route.startsWith("/trailers/")) {
        const activeImage = page.locator('figure img[class*="carouselActive"]');
        await activeImage.scrollIntoViewIfNeeded();
        await page.waitForFunction(() => {
          const img = document.querySelector('figure img[class*="carouselActive"]');
          return img?.complete && img.naturalWidth > 0;
        });
        const otherPage = await context.newPage();
        await otherPage.bringToFront();
        await page.waitForTimeout(5000);
        await otherPage.close();
        await page.bringToFront();
        await page.getByRole("button", { name: "Show trailer image 2", exact: true }).click();
        await page.waitForFunction(() => {
          const img = document.querySelector('figure img[class*="carouselActive"]');
          return img?.complete && img.naturalWidth > 0;
        });
        await page.screenshot({ path: path.join(outDir, `${name}-${width}-gallery.png`) });
        console.log(`Gallery: ${width}px ${route}; loaded after background/resume and manual selection`);
      }
      console.log(`Layout: ${width}px ${route}; one visible H1, no horizontal overflow`);
    }

    let requests = [];
    await page.route("**/api/lead", async (route) => {
      requests.push(route.request().postDataJSON());
      await route.fulfill(requests.length === 1
        ? { status: 403, json: { code: "recaptcha_expired", retryable: true } }
        : { status: 200, json: { ok: true, leadId: "website-test-123", analyticsLeadId: "test-hash" } });
    });
    await page.goto(`${base}/trailers/mobile-ct-trailer-rental`, { waitUntil: "networkidle" });
    const form = page.locator('form[data-form-type="trailer_request"]');
    await form.getByLabel("Name", { exact: true }).fill("QA Test");
    await form.getByLabel("Work email", { exact: true }).fill("qa@example.com");
    await form.getByLabel("Phone", { exact: true }).fill("2025550123");
    await form.locator("textarea").fill("Local-only test for CT trailer availability. No real inquiry.");
    await page.waitForTimeout(3000);
    await form.getByRole("button", { name: "Check Availability", exact: true }).click();
    await page.getByText("Request received", { exact: true }).waitFor();
    assert.equal(requests.length, 2);
    assert.equal(requests[0].analytics.leadId, requests[1].analytics.leadId);
    assert.notEqual(requests[0].token, requests[1].token);
    console.log(`Form: ${width}px expired token refreshed once, accepted without inbox writes`);

    requests = [];
    await page.goto(`${base}/contact`, { waitUntil: "networkidle" });
    await page.getByLabel("Name", { exact: true }).fill("QA Test");
    await page.getByLabel("Email", { exact: true }).fill("qa@example.com");
    await page.getByLabel("Request details", { exact: true }).fill("I need an MRI trailer rental. Local-only test.");
    await page.waitForTimeout(3000);
    await page.getByRole("button", { name: "Send Message", exact: true }).click();
    await page.locator('.response:not(.error)').waitFor();
    assert.equal(requests.length, 2);
    assert.equal(requests[1].formType, "trailer_request");
    console.log(`Contact: ${width}px general trailer inquiry accepted with optional phone`);

    await page.route("**/api/parts/search?**", (route) => route.fulfill({ json: { products: [], totalMatches: 0, hasNextPage: false, nextCursor: null } }));
    await page.goto(`${base}/parts?pn=PX72-07040-2`, { waitUntil: "networkidle" });
    const sourcing = page.getByRole("link", { name: "Request Part Sourcing", exact: true });
    await sourcing.waitFor();
    await sourcing.click();
    await page.getByLabel("OEM part number", { exact: true }).waitFor();
    assert.equal(await page.getByLabel("OEM part number", { exact: true }).inputValue(), "PX72-07040-2");
    console.log(`Catalog: ${width}px no-result sourcing preserves requested part number`);
    assert.deepEqual(errors, [], `Browser errors at ${width}px`);
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(`Screenshots: ${outDir}`);
