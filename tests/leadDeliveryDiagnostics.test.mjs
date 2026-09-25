import test from "node:test";
import assert from "node:assert/strict";
import { normalizeLeadAnalytics } from "../app/data/leadAnalytics.mjs";
import { getLeadMeasurement, normalizeLeadMeasurement, buildLeadDeliveryReport } from "../app/data/leadMeasurement.mjs";

const browser = { location: { hostname: "advancedimagingparts.com" }, __aisGaMeasurementId: "G-test" };
const human = { userAgent: "Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36" };

test("accepted-lead measurement context contains only allowlisted operational states", () => {
  assert.deepEqual(normalizeLeadMeasurement({ eligibility: "eligible", tagState: "loaded", marketingConsent: "granted",
    email: "private@example.com", gclid: "private-click-id", cookie: "private-cookie" }),
  { eligibility: "eligible", tagState: "loaded", marketingConsent: "granted" });
  for (const input of [null, [], "bad", { eligibility: "private@example.com", tagState: "confirmed" }]) {
    assert.deepEqual(normalizeLeadMeasurement(input),
      { eligibility: "unknown", tagState: "unknown", marketingConsent: "unknown" });
  }
  const normalized = normalizeLeadAnalytics({ measurement: { eligibility: "eligible", tagState: "failed" } });
  assert.equal(normalized.measurement.tagState, "failed");
  assert.equal(normalized.acquisitionSource, "unknown");
});

test("tag readiness does not override privacy, bot or local-environment exclusions", () => {
  assert.equal(getLeadMeasurement({ browser, navigator: human }).tagState, "queued");
  assert.equal(getLeadMeasurement({ browser: { ...browser, __aisGoogleTagState: "loaded" }, navigator: human }).tagState, "loaded");
  assert.equal(getLeadMeasurement({ browser: { ...browser, __aisGoogleTagState: "failed" }, navigator: human }).tagState, "failed");
  for (const navigator of [{ doNotTrack: "1" }, { globalPrivacyControl: true }]) {
    assert.deepEqual(getLeadMeasurement({ browser, navigator, consent: "granted" }),
      { eligibility: "privacy_opt_out", tagState: "not_initialized", marketingConsent: "denied" });
  }
  for (const args of [{ browser, navigator: { webdriver: true } },
    { browser: { location: { hostname: "localhost" } } }, { browser, navigator: { userAgent: "Googlebot" } }]) {
    assert.equal(getLeadMeasurement(args).eligibility, "excluded_environment");
  }
  // Marketing consent and basic analytics eligibility are separate policies.
  assert.equal(getLeadMeasurement({ browser, navigator: human, consent: "denied" }).eligibility, "eligible");
});

const accepted = (id, measurement) => ({ id: `lead-${id}`, eventType: "form_submit", date: "2026-09-25",
  properties: { lead_id: id, confirmed_by: "lead_api" }, measurement });
const signal = (id, eventType) => ({ id: `signal-${id}`, eventType, properties: { lead_id: id } });

test("delivery report reconciles unique accepted leads without claiming Google receipt", () => {
  const report = buildLeadDeliveryReport([
    accepted("lead-one"), accepted("lead-one"), accepted("lead-two"),
    accepted("lead-three", { eligibility: "privacy_opt_out" }),
    accepted("lead-four", { eligibility: "eligible", tagState: "failed" }),
    accepted("lead-five", { eligibility: "eligible", tagState: "loaded" }),
    accepted("lead-six", { eligibility: "excluded_environment" }),
    signal("lead-one", "lead_event_queued"), signal("lead-one", "lead_tag_processed"),
    signal("lead-one", "lead_tag_processed"), signal("not-a-lead", "lead_tag_processed"),
    { ...accepted("fake-lead"), id: "client-event" },
    { ...accepted("fake-two"), properties: { lead_id: "fake-two", confirmed_by: "client" } },
  ]);
  assert.equal(report.accepted, 6);
  assert.equal(report.queued, 1);
  assert.equal(report.tagProcessed, 1);
  assert.equal(report.duplicateDiagnosticLeads, 1);
  assert.equal(report.noBrowserDiagnostic, 5);
  assert.deepEqual(report.leads.map((row) => row.status), ["tag_processed_receipt_unverified", "legacy_or_unknown",
    "privacy_opt_out", "script_load_failed", "missing_browser_diagnostic", "excluded_environment"]);
  assert.match(report.note, /does not prove GA receipt/);
});
