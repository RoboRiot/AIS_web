import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { GOOGLE_TAG_MANAGER_SCRIPT } from "../app/data/googleTagManager.mjs";
import { MARKETING_CONSENT_KEY, CONSENT_MAX_AGE, DEFAULT_MARKETING_CONSENT,
  readMeasurementConsent, browserMeasurementConsent, initializeGoogleConsent,
  saveMeasurementConsent, synchronizeGoogleConsent } from "../app/data/marketingConsent.mjs";
import { ensureGoogleAnalytics } from "../app/data/browserGoogleAnalytics.mjs";
import { BUSINESS_PHONE, BUSINESS_PHONE_HREF, createGtmPhoneNumberBridge } from "../app/data/websiteCallTracking.mjs";

const plain = (value) => JSON.parse(JSON.stringify(value));
const memory = () => {
  const values = new Map();
  return { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
};
const browser = () => ({ localStorage: memory(), sessionStorage: memory(),
  location: new URL("https://advancedimagingparts.com/services/mri-service"),
  navigator: { userAgent: "Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36" } });
const runHead = (window) => {
  const inserted = [];
  const document = { createElement: () => ({}), getElementsByTagName: () => [
    { parentNode: { insertBefore: (script) => inserted.push({ script, queue: [...window.dataLayer] }) } },
  ] };
  vm.runInNewContext(GOOGLE_TAG_MANAGER_SCRIPT, { window, document });
  return inserted;
};

test("all four consent defaults and saved choices precede the first GTM event", () => {
  for (const advertising of ["granted", "denied", "unknown"]) {
    for (const analytics of ["granted", "denied", "unknown"]) {
      const window = browser();
      window.localStorage.setItem(MARKETING_CONSENT_KEY, JSON.stringify({ status: advertising, analyticsStatus: analytics, at: Date.now() }));
      const inserted = runHead(window);
      const expected = { ...DEFAULT_MARKETING_CONSENT,
        ad_storage: advertising === "granted" ? "granted" : "denied",
        ad_user_data: advertising === "granted" ? "granted" : "denied",
        analytics_storage: analytics === "granted" ? "granted" : "denied" };
      assert.deepEqual(plain([...inserted[0].queue[0]]), ["consent", "default", expected]);
      assert.equal(inserted[0].queue[1].event, "gtm.js");
      assert.equal(inserted[0].queue[1].ais_call_tracking_owner, "site-consent-v1");
      ensureGoogleAnalytics(window, "G-TEST");
      assert.equal(window.dataLayer.filter((row) => row[0] === "consent").length, 1);
    }
  }
});

test("old advertising permission does not imply new analytics permission", () => {
  const storage = memory();
  storage.setItem(MARKETING_CONSENT_KEY, JSON.stringify({ status: "granted", at: Date.now() }));
  assert.deepEqual(readMeasurementConsent({ storage }), { advertising: "granted", analytics: "unknown" });
});

test("malformed, expired, future and inaccessible storage fails closed in both initializers", () => {
  for (const value of ["bad JSON", "null", JSON.stringify({ status: "granted", analyticsStatus: "granted", at: Date.now() - CONSENT_MAX_AGE - 1000 }),
    JSON.stringify({ status: "granted", analyticsStatus: "granted", at: Date.now() + 60000 })]) {
    const first = browser();
    first.localStorage.setItem(MARKETING_CONSENT_KEY, value);
    runHead(first);
    assert.deepEqual(plain(first.dataLayer[0][2]), DEFAULT_MARKETING_CONSENT);
    const fallback = browser();
    fallback.localStorage.setItem(MARKETING_CONSENT_KEY, value);
    initializeGoogleConsent(fallback);
    assert.deepEqual(fallback.dataLayer[0][2], DEFAULT_MARKETING_CONSENT);
  }
  const restricted = browser();
  Object.defineProperty(restricted, "localStorage", { get() { throw new Error("blocked"); } });
  runHead(restricted);
  assert.deepEqual(plain(restricted.dataLayer[0][2]), DEFAULT_MARKETING_CONSENT);
  saveMeasurementConsent(restricted, { advertising: "granted", analytics: "denied" });
  assert.deepEqual(browserMeasurementConsent(restricted), { advertising: "granted", analytics: "denied" });
});

test("consent changes update immediately, preserve personalization denial and honor privacy signals", () => {
  const window = browser();
  initializeGoogleConsent(window);
  saveMeasurementConsent(window, { advertising: "granted", analytics: "granted" });
  assert.equal(window.dataLayer.at(-1)[1], "update");
  assert.equal(window.dataLayer.at(-1)[2].ad_personalization, "denied");
  assert.equal(window.dataLayer.at(-1)[2].analytics_storage, "granted");
  const length = window.dataLayer.length;
  synchronizeGoogleConsent(window);
  assert.equal(window.dataLayer.length, length);
  window.localStorage.setItem("ais_visitor_id", "test-id");
  saveMeasurementConsent(window, { advertising: "denied", analytics: "denied" });
  assert.deepEqual(window.dataLayer.at(-1)[2], DEFAULT_MARKETING_CONSENT);
  assert.equal(window.localStorage.getItem("ais_visitor_id"), null);
  for (const signal of [{ doNotTrack: "1" }, { globalPrivacyControl: true }]) {
    window.navigator = signal;
    saveMeasurementConsent(window, { advertising: "granted", analytics: "granted" });
    assert.deepEqual(synchronizeGoogleConsent(window), DEFAULT_MARKETING_CONSENT);
  }
});

function phoneDocument() {
  const anchors = [];
  const add = (text, href = BUSINESS_PHONE_HREF) => {
    const node = { nodeValue: text, isConnected: true };
    const attributes = new Map([["href", href]]);
    const anchor = { node, isConnected: true, writes: 0,
      get textContent() { return node.nodeValue; },
      getAttribute: (key) => attributes.get(key) ?? null,
      setAttribute(key, value) { this.writes++; attributes.set(key, value); },
      removeAttribute(key) { attributes.delete(key); } };
    anchors.push(anchor);
    return anchor;
  };
  const source = add(BUSINESS_PHONE);
  source.setAttribute("data-ais-call-source", "true");
  return { source, add, anchors,
    querySelector: () => source,
    querySelectorAll: (selector) => {
      if (selector === "[data-ais-call-source]") return anchors.filter((anchor) => anchor.getAttribute("data-ais-call-source") === "true");
      const hrefs = [...selector.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
      return anchors.filter((anchor) => anchor.isConnected && hrefs.includes(anchor.getAttribute("href")));
    },
    createTreeWalker: (anchor) => {
      let visited = false;
      return { nextNode() { if (visited) return null; visited = true; return anchor.node; } };
    },
  };
}

test("GTM is the only number source; mobile and SPA links stay consistent without mutation loops", () => {
  const document = phoneDocument();
  const cta = document.add("Call for rental availability");
  const bridge = createGtmPhoneNumberBridge(document);
  bridge.synchronize(true);
  assert.equal(cta.getAttribute("href"), BUSINESS_PHONE_HREF);
  // Synthetic DOM fixture only: no request to Google and no call is made.
  document.source.node.nodeValue = "(800) 555-0123";
  bridge.synchronize(true);
  assert.equal(document.source.getAttribute("href"), "tel:+18005550123");
  assert.equal(cta.getAttribute("href"), "tel:+18005550123");
  assert.equal(cta.textContent, "Call for rental availability");
  const writes = document.anchors.reduce((sum, anchor) => sum + anchor.writes, 0);
  bridge.synchronize(true);
  assert.equal(document.anchors.reduce((sum, anchor) => sum + anchor.writes, 0), writes);
  const newCta = document.add(`Call ${BUSINESS_PHONE}`);
  bridge.synchronize(true);
  assert.equal(newCta.getAttribute("href"), "tel:+18005550123");
  assert.equal(newCta.textContent, "Call (800) 555-0123");
  bridge.synchronize(false);
  for (const anchor of document.anchors) assert.equal(anchor.getAttribute("href"), BUSINESS_PHONE_HREF);
  assert.equal(document.source.textContent, BUSINESS_PHONE);
  assert.equal(newCta.textContent, `Call ${BUSINESS_PHONE}`);
});

test("revocation restores numbers GTM inserted before hydration and rejects mismatched destinations", () => {
  const document = phoneDocument();
  document.source.node.nodeValue = "(800) 555-0123";
  document.source.setAttribute("href", "tel:+18005550123");
  const earlyCta = document.add("Call (800) 555-0123", "tel:+18005550123");
  const bridge = createGtmPhoneNumberBridge(document);
  bridge.synchronize(false);
  assert.equal(earlyCta.getAttribute("href"), BUSINESS_PHONE_HREF);
  assert.equal(earlyCta.textContent, `Call ${BUSINESS_PHONE}`);
  document.source.node.nodeValue = "(800) 555-0123";
  document.source.setAttribute("href", "tel:+18005550999");
  bridge.synchronize(true);
  assert.equal(earlyCta.getAttribute("href"), BUSINESS_PHONE_HREF);
});

test("mobile replacement can use the footer when the hidden desktop number is unchanged", () => {
  const document = phoneDocument();
  const footer = document.add("(800) 555-0123");
  footer.setAttribute("data-ais-call-source", "true");
  const cta = document.add("Call for availability");
  const bridge = createGtmPhoneNumberBridge(document);
  bridge.synchronize(true);
  assert.equal(cta.getAttribute("href"), "tel:+18005550123");
  assert.equal(document.source.textContent, "(800) 555-0123");
  bridge.synchronize(false);
  assert.equal(footer.textContent, BUSINESS_PHONE);
  assert.equal(cta.getAttribute("href"), BUSINESS_PHONE_HREF);
});

test("the website no longer emits either call label or a connected-call conversion", async () => {
  const component = await readFile(new URL("../components/analytics/WebsiteCallTracking.js", import.meta.url), "utf8");
  const helper = await readFile(new URL("../app/data/websiteCallTracking.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(component + helper, /Bg2YCLSJpIAdEOGro75E|Lp8BCIzglaYdEOGro75E|phone_conversion_callback|gtag\("config"/);
  assert.match(component, /event: WEBSITE_CALL_GTM_EVENT/);
  assert.doesNotMatch(component, /gtag\("event",\s*"conversion"/);
});
