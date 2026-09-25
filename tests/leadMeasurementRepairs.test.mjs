import test from "node:test";
import assert from "node:assert/strict";
import { classifyLeadIntent, getBusinessFormType } from "../app/data/leadIntent.mjs";
import { ATTRIBUTION_RETENTION_MS, ATTRIBUTION_HISTORY_KEY, readAttributionHistory, normalizeAttributionHistory } from "../app/data/attributionHistory.mjs";
import { MARKETING_CONSENT_KEY, marketingConsent } from "../app/data/marketingConsent.mjs";
import { normalizeForwardingNumber, BUSINESS_PHONE_HREF, createPhoneNumberReplacement } from "../app/data/websiteCallTracking.mjs";
import { createLeadEventDispatcher } from "../app/data/browserGoogleAnalytics.mjs";
import { getCatalogIdentifiers, getCampaignReadinessIssues } from "../app/data/catalogProductQuality.mjs";

const memory = () => {
  const data = new Map();
  return { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
};
const now = Date.now();
const paid = { acquisition_source: "paid_search", landing_path: "/trailers", gclid: "example-ad-click-123", utm_campaign: "mri" };

test("a service-category inquiry can have MRI trailer intent without becoming paid", () => {
  const original = { formType: "service_request", acquisitionSource: "google_organic" };
  const intent = classifyLeadIntent(original.formType, "Please quote a mobile MRI trailer lease for our facility.");
  const record = { ...original, ...intent, selectedFormType: original.formType };
  assert.equal(getBusinessFormType(record), "trailer_request");
  assert.equal(record.selectedFormType, "service_request");
  assert.equal(record.modality, "mri");
  assert.equal(record.acquisitionSource, "google_organic");
  assert.equal(classifyLeadIntent("part_request", "CT trailer rental replacement parts").businessCategory, "parts");
  assert.equal(classifyLeadIntent("service_request", "Repair our CT trailer").businessCategory, "service");
  assert.equal(classifyLeadIntent("trailer_request", "PET/CT rental").modality, "pet_ct");
  assert.equal(classifyLeadIntent("contact_form", "MRI and CT trailer lease").modality, "multiple");
});

test("marketing history requires consent, expires, and never rewrites the current organic visit", () => {
  const storage = memory();
  assert.equal(readAttributionHistory({ current: paid, storage, now }).firstTouch, null);
  assert.equal(storage.getItem(ATTRIBUTION_HISTORY_KEY), undefined);
  const first = readAttributionHistory({ current: paid, storage, allowed: true, now });
  const organic = { acquisition_source: "google_organic", landing_path: "/contact" };
  const later = readAttributionHistory({ current: organic, storage, allowed: true, now: now + 1000 });
  assert.equal(later.firstTouch.acquisition_source, "paid_search");
  assert.equal(later.lastPaidTouch.gclid, paid.gclid);
  assert.equal(organic.acquisition_source, "google_organic");
  assert.equal(readAttributionHistory({ current: paid, storage, allowed: true, now: now + 2000 }).lastPaidTouch.at, first.lastPaidTouch.at);
  const expired = normalizeAttributionHistory(later, now + ATTRIBUTION_RETENTION_MS);
  assert.equal(expired.lastPaidTouch, null);
  readAttributionHistory({ current: organic, storage, allowed: false, now });
  assert.equal(storage.getItem(ATTRIBUTION_HISTORY_KEY), undefined);
});

test("consent respects privacy signals, unknown preferences and expiration", () => {
  const storage = memory();
  assert.equal(marketingConsent({ storage, now }), "unknown");
  storage.setItem(MARKETING_CONSENT_KEY, JSON.stringify({ status: "granted", at: now }));
  assert.equal(marketingConsent({ storage, now }), "granted");
  assert.equal(marketingConsent({ storage, now, navigator: { globalPrivacyControl: true } }), "denied");
  assert.equal(marketingConsent({ storage, now, navigator: { doNotTrack: "1" } }), "denied");
  assert.equal(marketingConsent({ storage, now: now + 181 * 86400000 }), "unknown");
});

test("forwarding callback validates matching displayed/dialed US numbers", () => {
  assert.deepEqual(normalizeForwardingNumber("(800) 555-0123", "18005550123"), { text: "(800) 555-0123", href: "tel:+18005550123" });
  assert.equal(normalizeForwardingNumber("(800) 555-0123", "18005550124"), null);
  assert.equal(normalizeForwardingNumber("bad", "javascript:alert(1)"), null);
});

test("number replacement preserves CTA text and restores original links on withdrawal", () => {
  const text = { nodeValue: "Call (559) 537-6851", isConnected: true };
  const anchor = { isConnected: true, href: BUSINESS_PHONE_HREF,
    getAttribute() { return this.href; }, setAttribute(key, value) { this.href = value; } };
  const document = { querySelectorAll: () => anchor.href === BUSINESS_PHONE_HREF ? [anchor] : [],
    createTreeWalker() { let seen = false; return { nextNode() { if (seen) return null; seen = true; return text; } }; } };
  const replacement = createPhoneNumberReplacement(document);
  replacement.apply(normalizeForwardingNumber("(800) 555-0123", "18005550123"));
  assert.equal(text.nodeValue, "Call (800) 555-0123");
  assert.equal(anchor.href, "tel:+18005550123");
  // A React rerender may restore the original href on an existing element.
  anchor.href = BUSINESS_PHONE_HREF;
  text.nodeValue = "Call (559) 537-6851";
  replacement.apply(normalizeForwardingNumber("(800) 555-0123", "18005550123"));
  assert.equal(anchor.href, "tel:+18005550123");
  assert.equal(text.nodeValue, "Call (800) 555-0123");
  replacement.restore();
  assert.equal(text.nodeValue, "Call (559) 537-6851");
  assert.equal(anchor.href, BUSINESS_PHONE_HREF);
});

test("lead diagnostics do not dispatch a second primary conversion", () => {
  const events = [];
  let processed = 0;
  const dispatch = createLeadEventDispatcher();
  const args = { gtag: (...args) => events.push(args), properties: { lead_id: "accepted-123", form_type: "trailer_request" },
    onProcessed: () => processed++ };
  assert.equal(dispatch(args), true);
  assert.equal(dispatch(args), false);
  assert.equal(events.filter((row) => row[1] === "generate_lead").length, 1);
  assert.equal(processed, 0);
  events[0][2].event_callback();
  events[0][2].event_callback();
  assert.equal(processed, 1);
});

test("new product repairs require exact records and retain image/visibility checks", () => {
  for (const [id, Name, PN, OEM] of [["temp-41", "46-170021p10 Fuse", "46-170021P10", "GE"],
    ["a60097f343dc", "BSX73-0893E Converter-16", "BSX73-0893E", "Toshiba"]]) {
    const product = { id, Name, Images: ["Parts/existing.jpg"] };
    assert.deepEqual(getCatalogIdentifiers(product), { PN, OEM, Modality: "CT" });
    assert.deepEqual(getCampaignReadinessIssues(product), []);
    assert.equal(getCatalogIdentifiers({ ...product, id: "other" }).PN, "");
    assert.equal(getCatalogIdentifiers({ ...product, Name: "different" }).PN, "");
    assert.equal(getCatalogIdentifiers({ ...product, PN: "OTHER" }).PN, "OTHER");
    assert.ok(getCampaignReadinessIssues({ ...product, Images: [] }).includes("missing-image"));
    assert.ok(getCampaignReadinessIssues({ ...product, Hidden: true }).includes("not-public"));
  }
});
