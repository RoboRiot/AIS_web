import assert from "node:assert/strict";
import test from "node:test";
import {
  getFormMilestone,
  getLeadEventName,
  normalizeFormType,
  normalizeLeadAnalytics,
  normalizeLeadId,
  shouldTrackLeadConversion,
} from "../app/data/leadAnalytics.mjs";

test("normalizes valid lead identifiers and rejects unsafe values", () => {
  assert.equal(normalizeLeadId("550E8400-E29B-41D4-A716-446655440000"), "550e8400-e29b-41d4-a716-446655440000");
  assert.equal(normalizeLeadId("bad"), "");
  assert.equal(normalizeLeadId("<script>alert(1)</script>"), "");
});

test("normalizes attribution without accepting arbitrary sources", () => {
  const analytics = normalizeLeadAnalytics({
    leadId: "550e8400-e29b-41d4-a716-446655440000",
    acquisition_source: "google_organic",
    landing_path: "/parts?q=coil",
    utm_campaign: "parts-search",
    gclid: "EAIaIQobChMI_test-click-id",
    msclkid: "unsafe click id",
  });

  assert.equal(analytics.acquisitionSource, "google_organic");
  assert.equal(analytics.landingPath, "/parts?q=coil");
  assert.equal(analytics.utm.campaign, "parts-search");
  assert.equal(analytics.clickIdPresent, true);
  assert.equal(analytics.clickIds.gclid, "EAIaIQobChMI_test-click-id");
  assert.equal(analytics.clickIds.msclkid, "");
  assert.equal(normalizeLeadAnalytics({ acquisition_source: "made-up" }).acquisitionSource, "unknown");
});

test("limits form types and funnel milestones", () => {
  assert.equal(normalizeFormType("trailer_request"), "trailer_request");
  assert.equal(normalizeFormType("newsletter"), "");
  assert.equal(getFormMilestone("form_submit"), "form_submit");
  assert.equal(getFormMilestone("form_error"), "");
});

test("maps accepted form types to distinct GA lead events", () => {
  assert.equal(getLeadEventName("contact_form"), "generate_contact_lead");
  assert.equal(getLeadEventName("part_request"), "generate_part_lead");
  assert.equal(getLeadEventName("service_request"), "generate_service_lead");
  assert.equal(getLeadEventName("trailer_request"), "generate_trailer_lead");
  assert.equal(getLeadEventName("unknown"), "");
});

test("accepts confirmed retry responses for lead-level deduplication", () => {
  assert.equal(shouldTrackLeadConversion({ ok: true }), true);
  assert.equal(shouldTrackLeadConversion({ ok: true, duplicate: false }), true);
  assert.equal(shouldTrackLeadConversion({ ok: true, duplicate: true }), true);
  assert.equal(shouldTrackLeadConversion({ ok: false }), false);
  assert.equal(shouldTrackLeadConversion(null), false);
});
