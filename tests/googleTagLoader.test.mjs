import test from "node:test";
import assert from "node:assert/strict";
import { startGoogleTagLoader } from "../app/data/googleTagLoader.mjs";
import { ensureGoogleAnalytics, createLeadEventDispatcher } from "../app/data/browserGoogleAnalytics.mjs";
import { getLeadMeasurement, buildLeadDeliveryReport } from "../app/data/leadMeasurement.mjs";

const harness = (navigator = {}) => {
  const timers = new Map(), listeners = new Map(), scripts = [], statuses = [];
  let timerId = 0;
  const events = {
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name) => listeners.delete(name),
  };
  const browser = { ...events, location: new URL("https://advancedimagingparts.com/contact"),
    navigator: { userAgent: "Mozilla/5.0 Chrome/140 Safari/537.36", onLine: true, ...navigator },
    setTimeout: (fn, delay) => { const id = ++timerId; timers.set(id, { fn, delay }); return id; },
    clearTimeout: (id) => timers.delete(id) };
  const document = { ...events, head: { appendChild: (script) => scripts.push(script) },
    createElement: () => ({ remove() { this.removed = true; } }) };
  const runTimer = (delay) => {
    const entry = [...timers].find(([, timer]) => timer.delay === delay);
    assert.ok(entry, `expected timer ${delay}`);
    timers.delete(entry[0]); entry[1].fn();
  };
  const start = () => startGoogleTagLoader(browser, document, "G-TEST", (status) => statuses.push(status));
  return { browser, document, timers, listeners, scripts, statuses, start, runTimer };
};

test("a transient tag load error retries the same URL and preserves one queued conversion", () => {
  const h = harness();
  const gtag = ensureGoogleAnalytics(h.browser, "G-TEST");
  h.start(); h.start();
  assert.equal(h.scripts.length, 1, "strict mode/remount does not duplicate loading");
  const dispatch = createLeadEventDispatcher();
  const props = { lead_id: "accepted-test-lead", form_type: "trailer_request" };
  dispatch({ gtag, properties: props });
  h.scripts[0].onerror();
  assert.equal(h.browser.__aisGoogleTagState, "failed");
  h.runTimer(1000);
  assert.equal(h.scripts[1].src, h.scripts[0].src);
  h.scripts[1].onload();
  assert.equal(h.browser.__aisGoogleTagState, "loaded");
  assert.equal(h.timers.size, 0);
  assert.equal(h.listeners.size, 0);
  assert.equal(dispatch({ gtag, properties: props }), false);
  assert.equal(h.browser.dataLayer.filter((row) => row[1] === "generate_lead").length, 1);
});

test("persistent errors stop after three attempts without alternate domains", () => {
  const h = harness(); h.start();
  h.scripts[0].onerror(); h.runTimer(1000);
  h.scripts[1].onerror(); h.runTimer(5000);
  h.scripts[2].onerror(); h.start();
  assert.equal(h.scripts.length, 3);
  assert.equal(h.timers.size, 0);
  assert.equal(h.listeners.size, 0);
  assert.deepEqual(h.browser.__aisGoogleTagDiagnostics, { tagLoadAttempts: 3, tagLoadError: "script_error" });
});

test("offline visits wait for connectivity and never start overlapping requests", () => {
  const h = harness({ onLine: false }); h.start();
  assert.equal(h.scripts.length, 0);
  assert.equal(h.browser.__aisGoogleTagDiagnostics.tagLoadError, "offline");
  h.browser.navigator.onLine = true;
  h.listeners.get("online")(); h.listeners.get("online")();
  assert.equal(h.scripts.length, 1);
  h.runTimer(15000);
  assert.equal(h.browser.__aisGoogleTagDiagnostics.tagLoadError, "load_timeout");
  assert.equal(h.scripts.length, 1, "a slow script is not executed twice");
  h.scripts[0].onload();
  assert.equal(h.browser.__aisGoogleTagState, "loaded");
});

test("a failed offline request resumes once and honors a newly enabled privacy signal", () => {
  const h = harness(); h.start();
  h.browser.navigator.onLine = false; h.scripts[0].onerror();
  assert.equal(h.timers.size, 0);
  h.browser.navigator.onLine = true;
  h.browser.navigator.globalPrivacyControl = true;
  h.listeners.get("online")();
  assert.equal(h.scripts.length, 1);
  assert.equal(h.listeners.size, 0);
});

test("losing connectivity on the third request can recover the existing queue", () => {
  const h = harness();
  const gtag = ensureGoogleAnalytics(h.browser, "G-TEST");
  createLeadEventDispatcher()({ gtag, properties: { lead_id: "offline-test", form_type: "trailer_request" } });
  h.start();
  h.scripts[0].onerror(); h.runTimer(1000);
  h.scripts[1].onerror(); h.runTimer(5000);
  h.browser.navigator.onLine = false; h.scripts[2].onerror();
  assert.equal(h.browser.__aisGoogleTagState, "queued");
  assert.equal(h.browser.__aisGoogleTagDiagnostics.tagLoadError, "offline");
  assert.equal(h.statuses.at(-1).tag_load_final, false);
  h.browser.navigator.onLine = true;
  h.listeners.get("online")();
  assert.equal(h.scripts.length, 4);
  h.scripts[3].onload();
  assert.equal(h.browser.__aisGoogleTagState, "loaded");
  assert.equal(h.statuses.at(-1).tag_load_final, true);
  assert.equal(h.browser.dataLayer.filter((row) => row[1] === "generate_lead").length, 1);
  assert.equal(h.listeners.size, 0);
});

test("diagnostics identify one document, order retries, and distinguish final failure", () => {
  const h = harness(); h.start();
  h.scripts[0].onerror(); h.runTimer(1000);
  h.browser.location = new URL("https://advancedimagingparts.com/trailers");
  h.scripts[1].onerror(); h.runTimer(5000);
  h.scripts[2].onerror();
  assert.equal(new Set(h.statuses.map((status) => status.tag_load_id)).size, 1);
  assert.deepEqual(h.statuses.map((status) => status.tag_load_sequence), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(h.statuses.map((status) => status.tag_load_final), [false, false, false, false, false, true]);
});

test("CSP failures are identified and stop retries, but report-only policies do not", () => {
  const h = harness(); h.start();
  const csp = h.listeners.get("securitypolicyviolation");
  const event = { blockedURI: h.scripts[0].src, effectiveDirective: "script-src-elem", disposition: "report" };
  csp(event);
  assert.equal(h.browser.__aisGoogleTagState, "queued");
  h.scripts[0].onerror();
  csp({ ...event, disposition: "enforce" });
  assert.equal(h.timers.size, 0);
  assert.equal(h.browser.__aisGoogleTagDiagnostics.tagLoadError, "csp_blocked");
  h.scripts[0].onload();
  assert.equal(h.browser.__aisGoogleTagState, "failed");
});

test("opt-outs and excluded environments never load or report a Google tag", () => {
  for (const changes of [{ doNotTrack: "1" }, { globalPrivacyControl: true },
    { webdriver: true }, { userAgent: "Googlebot" }]) {
    const h = harness(changes); assert.equal(h.start(), null);
    assert.equal(h.scripts.length, 0); assert.equal(h.statuses.length, 0);
  }
  const h = harness(); h.browser.location = new URL("http://localhost:3000");
  assert.equal(h.start(), null);
});

test("new measurement is bounded operational context and failures outrank queue-only signals", () => {
  const h = harness(); h.start(); h.scripts[0].onerror();
  const measurement = getLeadMeasurement({ browser: h.browser, navigator: h.browser.navigator });
  assert.equal(measurement.tagLoadAttempts, 1);
  assert.equal(measurement.tagLoadError, "script_error");
  const accepted = { id: "lead-accepted-test", eventType: "form_submit", measurement,
    properties: { lead_id: "accepted-test", confirmed_by: "lead_api" } };
  const queued = { eventType: "lead_event_queued", properties: { lead_id: "accepted-test" } };
  const report = buildLeadDeliveryReport([accepted, queued]);
  assert.equal(report.leads[0].status, "script_load_failed");
  assert.equal(report.scriptLoadFailed, 1);
  assert.equal(report.queued, 1);
  const recovered = buildLeadDeliveryReport([accepted, queued, { ...queued, eventType: "lead_tag_processed" }]);
  assert.equal(recovered.scriptLoadFailed, 0);
  assert.equal(recovered.leads[0].status, "tag_processed_receipt_unverified");
});
