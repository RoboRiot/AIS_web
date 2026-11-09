import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { normalizeLeadAnalytics } from "../app/data/leadAnalytics.mjs";
import { normalizeOpenAiClickId, OPENAI_CONVERSIONS_PIXEL_ID } from "../app/data/openAiConversionsConfig.mjs";
import { canMeasureOpenAiLead, createOpenAiConversion, deliverOpenAiConversion,
  getOpenAiConversionsConfig } from "../app/data/openAiConversions.mjs";

const timestamp = 1_800_000_000_000;
const clickId = "opaque.Ref%2Bvalue_0123456789";
const config = { pixelId: OPENAI_CONVERSIONS_PIXEL_ID, apiKey: "test-only-secret" };
const measurement = { eligibility: "eligible", marketingConsent: "granted" };
const analytics = { openAiClickId: clickId, measurement };
const input = { analytics, formType: "service_request", productionEligible: true,
  leadId: "223e4567-e89b-42d3-a456-426614174000", sourcePage: "/services/mri-service",
  now: timestamp, config };

function harness(record = createOpenAiConversion(input), overrides = {}) {
  let value = { eventType: "form_submit", formType: "service_request", measurement,
    properties: { confirmed_by: "lead_api" }, openAiConversion: record, ...overrides };
  let clock = timestamp;
  let queue = Promise.resolve();
  const eventReference = { path: "WebsiteAnalyticsEvents/lead-test-only" };
  const snapshot = () => {
    const copy = structuredClone(value);
    return { exists: Boolean(copy), data: () => copy,
      get: (key) => key.split(".").reduce((result, part) => result?.[part], copy) };
  };
  const db = {
    runTransaction(fn) {
      const operation = queue.then(async () => {
        const writes = [];
        const result = await fn({ get: async () => snapshot(),
          update: (_ref, fields) => writes.push(structuredClone(fields)) });
        for (const fields of writes) value = { ...value, ...fields };
        return result;
      });
      queue = operation.catch(() => {});
      return operation;
    },
  };
  return { db, eventReference, config, allowed: true, oppref: clickId,
    now: () => clock, wait: async (ms) => { clock += ms; },
    advance: (ms) => { clock += ms; }, value: () => structuredClone(value) };
}

const response = (status, headers = {}) => ({ status, headers: new Headers(headers) });

test("opaque click references are preserved and rejected rather than rewritten", () => {
  assert.equal(normalizeOpenAiClickId(clickId), clickId);
  for (const invalid of [null, 123, "", " value", "value ", "a\nb", "a\tb", "é", "a".repeat(2049)]) {
    assert.equal(normalizeOpenAiClickId(invalid), "");
  }
  assert.equal(normalizeOpenAiClickId("x".repeat(2048)).length, 2048);
  assert.equal(normalizeLeadAnalytics({ oppref: clickId, measurement }).openAiClickId, clickId);
  for (const changed of [{ marketingConsent: "denied" }, { marketingConsent: "unknown" }, { eligibility: "privacy_opt_out" }]) {
    assert.equal(normalizeLeadAnalytics({ oppref: clickId, measurement: { ...measurement, ...changed } }).openAiClickId, "");
  }
});

test("only consented production service and trailer inquiries can be queued", () => {
  for (const formType of ["service_request", "trailer_request"]) {
    assert.ok(createOpenAiConversion({ ...input, formType }));
  }
  for (const change of [
    { formType: "part_request" }, { formType: "contact_form" }, { productionEligible: false },
    { analytics: { ...analytics, openAiClickId: "" } },
    { analytics: { ...analytics, measurement: { ...measurement, marketingConsent: "denied" } } },
    { analytics: { ...analytics, measurement: { ...measurement, eligibility: "excluded_environment" } } },
    { leadId: "customer@example.com" }, { config: null },
  ]) assert.equal(createOpenAiConversion({ ...input, ...change }), null);
  assert.equal(canMeasureOpenAiLead({ ...input, formType: "contact_form" }), false);
  assert.equal(getOpenAiConversionsConfig({}), null);
  assert.equal(getOpenAiConversionsConfig({ OPENAI_CONVERSIONS_API_KEY: "test", OPENAI_CONVERSIONS_PIXEL_ID: "bad?pid" }), null);
});

test("outbox contains no raw click reference or inquiry data and source URLs use public paths", () => {
  const privateAnalytics = { ...analytics, email: "private@example.com", name: "Private Name",
    message: "Private inquiry", ip: "203.0.113.1" };
  const record = createOpenAiConversion({ ...input, analytics: privateAnalytics,
    sourcePage: "/services/mri-service?email=private@example.com#private" });
  assert.equal(record.event.source_url, "https://advancedimagingparts.com/services/mri-service");
  assert.equal(record.event.id, `ais_lead_${input.leadId}`);
  assert.equal(record.event.opt_out, true);
  assert.deepEqual(record.event.data, { type: "customer_action" });
  const encoded = JSON.stringify(record);
  for (const forbidden of [clickId, "private@example.com", "Private Name", "Private inquiry", "203.0.113.1"])
    assert.equal(encoded.includes(forbidden), false);
  for (const sourcePage of ["https://evil.example/", "/products/private-name", "/services/user@example.com", "//evil.example"]) {
    assert.equal(createOpenAiConversion({ ...input, sourcePage }).event.source_url,
      "https://advancedimagingparts.com/contact");
  }
});

test("accepted delivery emits the minimal payload once and persists acknowledgment", async () => {
  const h = harness();
  const calls = [];
  const fetchImpl = async (url, options) => { calls.push({ url, options }); return response(200); };
  assert.deepEqual(await deliverOpenAiConversion({ ...h, fetchImpl }), { status: "accepted" });
  assert.deepEqual(await deliverOpenAiConversion({ ...h, fetchImpl }), { status: "not_due" });
  assert.equal(calls.length, 1);
  const { url, options } = calls[0];
  assert.equal(url, `https://bzr.openai.com/v1/events?pid=${OPENAI_CONVERSIONS_PIXEL_ID}`);
  assert.equal(options.redirect, "error");
  assert.equal(options.headers.Authorization, "Bearer test-only-secret");
  const body = JSON.parse(options.body);
  assert.deepEqual(Object.keys(body), ["validate_only", "events"]);
  assert.equal(body.validate_only, false);
  assert.deepEqual(body.events, [{ ...createOpenAiConversion(input).event, oppref: clickId }]);
  assert.equal("user" in body.events[0], false);
  assert.equal(h.value().openAiConversion.status, "accepted");
  assert.equal(h.value().openAiConversion.attempts, 1);
  assert.equal(h.value().openAiConversion.clickIdFingerprint, "");
});

test("transient errors retry the same event ID and timestamp within a bounded request", async () => {
  const h = harness();
  const events = [];
  const fetchImpl = async (_url, options) => {
    events.push(JSON.parse(options.body).events[0]);
    if (events.length === 1) throw new Error("timeout with private data that must not be logged");
    return response(200);
  };
  assert.equal((await deliverOpenAiConversion({ ...h, fetchImpl })).status, "accepted");
  assert.equal(events.length, 2);
  assert.deepEqual(events[0], events[1]);
  assert.equal(h.value().openAiConversion.attempts, 2);
});

test("concurrent calls acquire one delivery lease", async () => {
  const h = harness();
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return response(200); };
  await Promise.all([deliverOpenAiConversion({ ...h, fetchImpl }), deliverOpenAiConversion({ ...h, fetchImpl })]);
  assert.equal(calls, 1);
});

test("pending failures can resume on a later consented duplicate but never exceed four attempts", async () => {
  const h = harness();
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return response(503); };
  assert.equal((await deliverOpenAiConversion({ ...h, fetchImpl })).status, "pending");
  assert.equal(calls, 2);
  assert.equal((await deliverOpenAiConversion({ ...h, fetchImpl })).status, "not_due");
  h.advance(30_000);
  assert.equal((await deliverOpenAiConversion({ ...h, fetchImpl })).status, "rejected");
  assert.equal(calls, 4);
  h.advance(30_000);
  await deliverOpenAiConversion({ ...h, fetchImpl });
  assert.equal(calls, 4);
});

test("rate-limit retry-after defers delivery and permanent rejection is not retried", async () => {
  const h = harness();
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return response(429, { "retry-after": "60" }); };
  assert.equal((await deliverOpenAiConversion({ ...h, fetchImpl })).status, "pending");
  assert.equal(calls, 1);
  h.advance(59_000);
  assert.equal((await deliverOpenAiConversion({ ...h, fetchImpl })).status, "not_due");
  h.advance(1_000);
  assert.equal((await deliverOpenAiConversion({ ...h, fetchImpl: async () => response(400) })).status, "rejected");
  assert.equal((await deliverOpenAiConversion({ ...h, fetchImpl })).status, "not_due");
});

test("withdrawn consent, mismatched references, missing acceptance, and expired events never send", async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return response(200); };
  await deliverOpenAiConversion({ ...harness(), allowed: false, fetchImpl });
  await deliverOpenAiConversion({ ...harness(), oppref: "different-reference", fetchImpl });
  await deliverOpenAiConversion({ ...harness(null), fetchImpl });
  await deliverOpenAiConversion({ ...harness(undefined, { eventType: "form_start" }), fetchImpl });
  await deliverOpenAiConversion({ ...harness(undefined, { measurement: { ...measurement, marketingConsent: "denied" } }), fetchImpl });
  const expired = harness();
  expired.advance(7 * 24 * 60 * 60_000 + 1);
  await deliverOpenAiConversion({ ...expired, fetchImpl });
  assert.equal(expired.value().openAiConversion.status, "expired");
  assert.equal(calls, 0);
});

test("storage outages and all measurement errors remain non-throwing", async () => {
  const h = harness();
  const db = { runTransaction: async () => { throw new Error("offline"); } };
  assert.equal((await deliverOpenAiConversion({ ...h, db, fetchImpl: async () => response(200) })).status, "unavailable");
  const noConfig = await deliverOpenAiConversion({ ...h, config: null });
  assert.equal(noConfig.status, "disabled");
});

test("operational diagnostics do not select the private outbox field", async () => {
  const source = await readFile(new URL("../scripts/report-lead-diagnostics.mjs", import.meta.url), "utf8");
  assert.match(source, /\.select\(/);
  assert.equal(source.includes("openAiConversion"), false);
});
