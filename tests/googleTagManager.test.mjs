import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import {
  GOOGLE_TAG_MANAGER_ID,
  GOOGLE_TAG_MANAGER_SCRIPT,
  GOOGLE_TAG_MANAGER_NOSCRIPT_URL,
} from "../app/data/googleTagManager.mjs";
import { ANALYTICS_HOSTS, AUTOMATION_USER_AGENT_MARKERS } from "../app/data/analyticsPolicy.mjs";
import { DEFAULT_MARKETING_CONSENT } from "../app/data/marketingConsent.mjs";
import { ensureGoogleAnalytics, createLeadEventDispatcher } from "../app/data/browserGoogleAnalytics.mjs";

const humanAgent = "Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36";
const plain = (value) => JSON.parse(JSON.stringify(value));
const harness = ({ hostname = "advancedimagingparts.com", navigator = {}, ...browser } = {}) => {
  const inserted = [];
  const window = {
    location: new URL(`https://${hostname}/contact`),
    navigator: { userAgent: humanAgent, ...navigator },
    ...browser,
  };
  const firstScript = { parentNode: { insertBefore: (script, before) => {
    assert.equal(before, firstScript);
    inserted.push({ script, queued: Array.from(window.dataLayer) });
  } } };
  const document = {
    getElementsByTagName: (name) => { assert.equal(name, "script"); return [firstScript]; },
    createElement: (name) => { assert.equal(name, "script"); return {}; },
  };
  return { window, inserted, run: () => vm.runInNewContext(GOOGLE_TAG_MANAGER_SCRIPT, { window, document }) };
};

test("GTM queues advertising consent defaults before loading exactly one supplied container", () => {
  const browser = harness();
  browser.run();
  browser.run();
  assert.equal(browser.inserted.length, 1);
  const { script, queued } = browser.inserted[0];
  assert.equal(script.async, true);
  assert.equal(script.src, `https://www.googletagmanager.com/gtm.js?id=${GOOGLE_TAG_MANAGER_ID}`);
  assert.deepEqual(plain(Array.from(queued[0])), ["consent", "default", DEFAULT_MARKETING_CONSENT]);
  assert.equal(queued[1].event, "gtm.js");
  assert.equal(typeof queued[1]["gtm.start"], "number");
  assert.equal(queued.length, 2);
  assert.equal(browser.window.__aisMarketingConsentInitialized, true);
});

test("GTM respects production-host, automation, DNT and GPC exclusions before any Google request", () => {
  for (const options of [
    { hostname: "localhost" },
    { hostname: "127.0.0.1" },
    { hostname: "advancedimaging.duckdns.org" },
    { hostname: "164.92.111.36" },
    { hostname: "advancedimagingparts.com.example.org" },
    { navigator: { doNotTrack: "1" } },
    { navigator: { globalPrivacyControl: true } },
    { navigator: { webdriver: true } },
    { navigator: { userAgent: "" } },
    ...AUTOMATION_USER_AGENT_MARKERS.map((marker) => ({ navigator: { userAgent: `Mozilla/5.0 ${marker}` } })),
  ]) {
    const browser = harness(options);
    browser.run();
    assert.equal(browser.inserted.length, 0, JSON.stringify(options));
    assert.equal(browser.window.dataLayer, undefined, JSON.stringify(options));
  }
  for (const hostname of ANALYTICS_HOSTS) {
    const browser = harness({ hostname });
    browser.run();
    assert.equal(browser.inserted.length, 1, hostname);
  }
});

test("GTM preserves an existing data layer and does not reset initialized consent", () => {
  const dataLayer = [{ event: "existing-event" }];
  const browser = harness({ dataLayer, __aisMarketingConsentInitialized: true });
  browser.run();
  assert.equal(browser.window.dataLayer, dataLayer);
  assert.equal(dataLayer[0].event, "existing-event");
  assert.equal(dataLayer[1].event, "gtm.js");
  assert.equal(dataLayer.length, 2);
});

test("GTM does not configure GA or duplicate the existing accepted-lead dispatcher", () => {
  const browser = harness();
  browser.run();
  const gtag = ensureGoogleAnalytics(browser.window, "G-TEST");
  ensureGoogleAnalytics(browser.window, "G-TEST");
  const dispatch = createLeadEventDispatcher();
  const properties = { lead_id: "unit-test-lead", form_type: "trailer_request" };
  assert.equal(dispatch({ gtag, properties }), true);
  assert.equal(dispatch({ gtag, properties }), false);
  const queue = browser.window.dataLayer;
  assert.equal(queue.filter((args) => args[0] === "consent").length, 1);
  assert.equal(queue.filter((args) => args[0] === "config").length, 1);
  assert.equal(queue.find((args) => args[0] === "config")[2].send_page_view, false);
  assert.equal(queue.filter((args) => args[1] === "generate_lead").length, 1);
  assert.equal(queue.filter((args) => args[1] === "generate_trailer_lead").length, 1);
});

test("the shared layout places GTM in head and its fallback first in body", async () => {
  const layout = await readFile(new URL("../app/layout.js", import.meta.url), "utf8");
  assert.match(layout, /<head>\s*<script\s+id="google-tag-manager"/);
  assert.match(layout, /<body>\s*<noscript>\s*<iframe/);
  assert.match(layout, /src=\{GOOGLE_TAG_MANAGER_NOSCRIPT_URL\}/);
  assert.match(layout, /style=\{\{ display: "none", visibility: "hidden" \}\}/);
  assert.equal(GOOGLE_TAG_MANAGER_NOSCRIPT_URL, "https://www.googletagmanager.com/ns.html?id=GTM-MQJJ4Z5S");
});
