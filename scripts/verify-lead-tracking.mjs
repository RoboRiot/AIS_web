import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const base = process.env.AIS_VERIFY_URL || "http://127.0.0.1:3092";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Local builds only");
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || process.argv[2] || "playwright");
const origin = "https://advancedimagingparts.com";
const output = path.resolve(".tmp/lead-tracking-verification");
await mkdir(output, { recursive: true });
const localPost = (pathname, body, headers = {}) => fetch(base + pathname, {
  method: "POST", headers: { Origin: base, "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
});
const sessionResponse = await localPost("/api/lead/session", { formType: "trailer_request", leadId: "local-http-test" });
assert.equal(sessionResponse.status, 200);
assert.equal(sessionResponse.headers.get("cache-control"), "no-store");
const session = await sessionResponse.json();
assert.ok(session.formSession && session.waitMs >= 2_500);
const rejectedOrigin = await localPost("/api/lead/session", {}, { Origin: "https://untrusted.example", "sec-fetch-site": "cross-site" });
assert.equal(rejectedOrigin.status, 403);
const tampered = await localPost("/api/lead", { formType: "trailer_request", action: "trailer_request",
  analytics: { leadId: "local-http-test" }, formSession: `${session.formSession}x` });
assert.equal(tampered.status, 403);
assert.equal((await tampered.json()).timingReason, "invalid_session");
console.log("Local timing endpoint: signed session, no-store, origin rejection, tamper rejection; no lead writes");
const legacyPaths = [
  "/products/2-hd-nv-array",
  "/products/terminal-servrer-pwr-supply",
  "/products/lightspeed-performix-40-plus-ct-tube-liquid-bearing",
];
for (const oldPath of legacyPaths) {
  for (let pass = 0; pass < 2; pass++) {
    const response = await fetch(base + oldPath, { redirect: "manual" });
    assert.equal(response.status, 308, oldPath);
    const destination = new URL(response.headers.get("location"), base);
    assert.match(destination.pathname, /--id-/);
    const canonical = await fetch(base + destination.pathname, { redirect: "manual" });
    assert.equal(canonical.status, 200, destination.pathname);
    console.log(`Legacy redirect ${pass ? "warm" : "cold"}: 308 -> 200 ${oldPath}`);
  }
}

const browser = await chromium.launch({ headless: true, channel: "chrome" });
let activePage;
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36" });
    const submissions = [];
    const analytics = [];
    let mode = "timing";
    let attempt = 0;
    // Virtual production origin exercises the real production-only analytics gate against LOCAL HTML.
    // ALL browser traffic is intercepted: no test inquiry, click ID or event can reach production/Google.
    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === "/api/analytics") {
        analytics.push(request.postDataJSON());
        return route.fulfill({ json: { ok: true } });
      }
      if (url.pathname === "/api/lead/session") {
        return route.fulfill({ json: { ok: true, formSession: "local-signed-session", waitMs: 2_600 } });
      }
      if (url.pathname === "/api/lead") {
        submissions.push(request.postDataJSON());
        attempt++;
        if (mode === "timing" && attempt === 1) return route.fulfill({ status: 403, json: { code: "form_timing", retryable: true } });
        if (mode === "network" && attempt === 1) return route.abort("failed");
        if (mode === "rejected") return route.fulfill({ status: 403, json: { code: "recaptcha_score", error: "Verification rejected" } });
        return route.fulfill({ json: { ok: true, duplicate: mode === "network", leadId: `website-local-${submissions.at(-1).analytics.leadId}`,
          analyticsLeadId: `local-${submissions.at(-1).analytics.leadId}` } });
      }
      if (request.method() !== "GET") return route.abort();
      const response = await route.fetch({ url: base + url.pathname + url.search });
      await route.fulfill({ response });
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
      window.grecaptcha = { ready: (cb) => cb(), execute: async () => `local-only-${Date.now()}` };
      sessionStorage.setItem("ais_session_attribution", JSON.stringify({ acquisition_source: "google_organic", landing_path: "/parts" }));
    });
    const page = await context.newPage();
    activePage = page;
    page.setDefaultTimeout(15_000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const landing = await page.goto(`${origin}/trailers/mobile-ct-trailer-rental?gclid=local-qa-click-${width}&utm_source=google&utm_medium=cpc&utm_campaign=CT-QA`, { waitUntil: "networkidle" });
    assert.equal(landing.status(), 200);
    // Use client navigation, preserving the same tab and acquisition context.
    const contact = page.locator('a[href="/contact"]:visible').first();
    await contact.click();
    await page.getByLabel("Name", { exact: true }).waitFor();
    await page.waitForLoadState("networkidle");
    await page.waitForFunction(() => window.dataLayer?.some((entry) => entry[0] === "event" && entry[1] === "page_view" && entry[2]?.page_path === "/contact"));
    const fill = async () => {
      await page.getByLabel("Name", { exact: true }).fill("Local QA");
      await page.getByLabel("Email", { exact: true }).fill("local-qa@example.com");
      await page.getByLabel("Request details", { exact: true }).fill("Local-only CT trailer inquiry. Do not send.");
      await page.waitForTimeout(2_600);
      assert.equal(await page.getByLabel("Name", { exact: true }).inputValue(), "Local QA");
    };
    await fill();
    await page.getByRole("button", { name: "Send Message", exact: true }).click();
    await page.getByText(/Trailer request received/).waitFor();
    assert.equal(submissions.length, 2);
    assert.equal(submissions[0].analytics.leadId, submissions[1].analytics.leadId);
    assert.equal(submissions[1].formSession, "local-signed-session");
    assert.equal(submissions[1].analytics.gclid, `local-qa-click-${width}`);
    assert.equal(submissions[1].analytics.acquisition_source, "paid_search");
    assert.equal(submissions[1].analytics.landing_path, "/trailers/mobile-ct-trailer-rental");
    assert.equal(submissions[1].formType, "trailer_request");
    const leadEvents = () => page.evaluate(() => (window.dataLayer || []).map((entry) => [...entry]).filter((entry) => entry[0] === "event" && entry[1] === "generate_lead"));
    let leads = await leadEvents();
    assert.equal(leads.length, 1);
    assert.equal(leads[0][2].lead_id, `local-${submissions[1].analytics.leadId}`);
    assert.equal(leads[0][2].page_path, "/contact");
    assert.equal(leads[0][2].form_type, "trailer_request");
    assert.doesNotMatch(JSON.stringify(leads), /local-qa@example|Do not send|gclid/);
    assert.equal(analytics.filter((event) => event.eventType === "form_submit").length, 0, "Server owns first-party accepted lead counting");
    assert.notEqual(await page.locator('form[data-form-type]').getAttribute('data-lead-id'), submissions[1].analytics.leadId);
    assert.equal(await page.getByLabel("Request details", { exact: true }).inputValue(), "");
    await page.locator('.response:not(.error)').screenshot({ path: path.join(output, `contact-success-${width}.png`) });
    console.log(`${width}px: paid CT landing -> contact -> stale timer recovery -> one queued GA4 lead, no PII`);

    mode = "network"; attempt = 0;
    await fill();
    await page.getByRole("button", { name: "Send Message", exact: true }).click();
    await page.locator('.response.error').waitFor();
    assert.equal((await leadEvents()).length, 1, "Unconfirmed request is not a conversion");
    const retryId = submissions.at(-1).analytics.leadId;
    assert.notEqual(retryId, submissions[0].analytics.leadId, "New inquiry gets a new ID");
    await page.getByRole("button", { name: "Send Message", exact: true }).click();
    await page.getByText(/Trailer request received/).waitFor();
    leads = await leadEvents();
    assert.equal(leads.length, 2, "Accepted duplicate recovers the lost response");
    assert.equal(submissions.at(-1).analytics.leadId, retryId);
    assert.equal(leads.at(-1)[2].lead_id, `local-${retryId}`);
    assert.equal(analytics.filter((event) => event.eventType === "form_start" && event.properties.lead_id === retryId).length, 1);
    console.log(`${width}px: lost response -> manual retry -> accepted duplicate -> one additional conversion`);

    mode = "rejected"; attempt = 0;
    await fill();
    await page.getByRole("button", { name: "Send Message", exact: true }).click();
    await page.locator('.response.error').waitFor();
    assert.equal(attempt, 1);
    assert.equal((await leadEvents()).length, 2, "Rejected submission is not a conversion");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    // A deliberately aborted request is logged by the app but must not throw an uncaught browser error.
    assert.deepEqual(errors, []);
    await context.close();
  }
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: path.join(output, "failure.png"), fullPage: true });
    console.error("Local QA failure page:", await activePage.locator("body").innerText());
  }
  throw error;
} finally { await browser.close(); }
console.log(`Local-only browser verification passed. Screenshots: ${output}`);
