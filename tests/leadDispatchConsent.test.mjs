import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { saveMeasurementConsent } from "../app/data/marketingConsent.mjs";

const ledgerKey = "ais_queued_lead_events";
const properties = { lead_id: "accepted-test-lead", form_type: "trailer_request" };
const source = (await readFile(new URL("../components/utils/analytics.js", import.meta.url), "utf8"))
  .replace(/from "(@\/[^"]+)"/g, (_, path) =>
    `from ${JSON.stringify(new URL(`../${path.slice(2)}`, import.meta.url).href)}`);
let instance = 0;
// Load the actual browser entry point with its normal helpers, resolving only Next's path alias.
const loadAnalytics = () => import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}#${++instance}`);

function memoryStorage() {
  const values = new Map(), reads = [], writes = [];
  return { values, reads, writes,
    getItem(key) { reads.push(key); return values.get(key) ?? null; },
    setItem(key, value) { writes.push(key); values.set(key, value); },
    removeItem(key) { values.delete(key); } };
}

async function withBrowser(analyticsConsent, run, { blocked = false, signal = {} } = {}) {
  const originals = new Map(["window", "document", "navigator", "fetch"].map(key =>
    [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const storage = memoryStorage(), requests = [];
  const navigator = { userAgent: "Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36", ...signal };
  const document = { referrer: "" };
  const browser = { location: new URL("https://advancedimagingparts.com/contact"), navigator, document,
    sessionStorage: memoryStorage(), __aisConsentChoice: {
      status: "denied", analyticsStatus: analyticsConsent, at: Date.now(),
    } };
  Object.defineProperty(browser, "localStorage", blocked
    ? { get() { throw Error("storage unavailable"); } }
    : { value: storage });
  const globals = { window: browser, document, navigator,
    fetch: async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return { ok: true }; } };
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  try { await run({ browser, storage, requests, analytics: await loadAnalytics() }); }
  finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}

const events = (browser, name) => (browser.dataLayer || []).filter(args => args[0] === "event" && args[1] === name);

test("denied and unknown analytics consent use memory dedup without reading or writing the persisted lead ledger", async () => {
  for (const consent of ["denied", "unknown"]) {
    await withBrowser(consent, async ({ browser, storage, requests, analytics }) => {
      // A prior consented visit's ledger must not be read while consent is absent.
      storage.values.set(ledgerKey, JSON.stringify([[properties.lead_id, Date.now()]]));
      analytics.trackWebsiteEvent("form_submit", properties);
      analytics.trackWebsiteEvent("form_submit", properties);
      assert.equal(events(browser, "generate_lead").length, 1);
      assert.equal(events(browser, "generate_trailer_lead").length, 1);
      assert.equal(storage.reads.includes(ledgerKey), false);
      assert.equal(storage.writes.includes(ledgerKey), false);
      assert.equal(requests.filter(request => request.body.eventType === "lead_event_queued").length, 1);
      const callback = events(browser, "generate_lead")[0][2].event_callback;
      callback(); callback();
      assert.equal(requests.filter(request => request.body.eventType === "lead_tag_processed").length, 1);
      assert.equal(analytics.getLeadAnalyticsContext().measurement.analyticsConsent, consent);
    });
  }
});

test("analytics consent preserves durable duplicate suppression across a fresh browser module", async () => {
  await withBrowser("granted", async ({ browser, storage, analytics }) => {
    analytics.trackWebsiteEvent("form_submit", properties);
    assert.equal(storage.writes.filter(key => key === ledgerKey).length, 1);
    const reloaded = await loadAnalytics();
    reloaded.trackWebsiteEvent("form_submit", properties);
    assert.equal(events(browser, "generate_lead").length, 1);
    assert.equal(events(browser, "generate_trailer_lead").length, 1);
  });
});

test("unavailable storage retains one accepted-lead event and one diagnostic in memory", async () => {
  await withBrowser("granted", async ({ browser, requests, analytics }) => {
    assert.doesNotThrow(() => {
      analytics.trackWebsiteEvent("form_submit", properties);
      analytics.trackWebsiteEvent("form_submit", properties);
    });
    assert.equal(events(browser, "generate_lead").length, 1);
    assert.equal(requests.filter(request => request.body.eventType === "lead_event_queued").length, 1);
  }, { blocked: true });
});

test("withdrawal removes the persisted ledger while retaining memory dedup for accepted leads", async () => {
  await withBrowser("granted", async ({ browser, storage, analytics }) => {
    analytics.trackWebsiteEvent("form_submit", properties);
    assert.equal(storage.values.has(ledgerKey), true);
    saveMeasurementConsent(browser, { advertising: "denied", analytics: "denied" });
    assert.equal(storage.values.has(ledgerKey), false);
    analytics.trackWebsiteEvent("form_submit", properties);
    assert.equal(events(browser, "generate_lead").length, 1);
    analytics.trackWebsiteEvent("form_submit", { ...properties, lead_id: "another-accepted-lead" });
    assert.equal(events(browser, "generate_lead").length, 2);
    assert.equal(storage.writes.filter(key => key === ledgerKey).length, 1);
    assert.equal(storage.values.has(ledgerKey), false);
  });
});

test("DNT and GPC still block Google dispatch and persistent lead storage", async () => {
  for (const signal of [{ doNotTrack: "1" }, { globalPrivacyControl: true }]) {
    await withBrowser("granted", async ({ browser, storage, requests, analytics }) => {
      analytics.trackWebsiteEvent("form_submit", properties);
      assert.equal(events(browser, "generate_lead").length, 0);
      assert.equal(storage.reads.includes(ledgerKey), false);
      assert.equal(storage.writes.includes(ledgerKey), false);
      assert.equal(requests.length, 0);
    }, { signal });
  }
});
