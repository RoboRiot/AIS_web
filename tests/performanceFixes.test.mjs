import test from "node:test";
import assert from "node:assert/strict";
import { assessRecaptcha } from "../app/data/recaptchaPolicy.mjs";
import { postLeadWithRetry } from "../app/data/leadSubmission.mjs";
import { isCtTubeProduct } from "../app/data/catalogRelevance.mjs";
import { cleanCatalogProductName } from "../app/data/catalogProductQuality.mjs";
import { getCatalogLookupPlans, buildCatalogSearchFields } from "../app/data/partCatalogIndex.mjs";
import { getGeneralCatalogSearchScore } from "../app/data/partCatalogSearch.mjs";
import { buildPartSourcingHref } from "../app/data/partSourcing.mjs";
import { inferLeadFormType, requiresContactPhone } from "../app/data/leadIntent.mjs";
import { analyticsPageUrl, redactAnalyticsText } from "../app/data/analyticsPrivacy.mjs";

const verificationOptions = { expectedAction: "trailer_request", allowedHosts: ["advancedimagingparts.com"] };
const verified = { success: true, action: "trailer_request", hostname: "advancedimagingparts.com", score: 0.8 };

test("reCAPTCHA validates action, hostname and score without retrying spam decisions", () => {
  assert.equal(assessRecaptcha(verified, verificationOptions).ok, true);
  for (const [field, value, code] of [["action", "contact_form", "recaptcha_action"], ["hostname", "attacker.test", "recaptcha_hostname"], ["score", 0.1, "recaptcha_score"], ["score", NaN, "recaptcha_score"]]) {
    assert.deepEqual(assessRecaptcha({ ...verified, [field]: value }, verificationOptions), { ok: false, code, retryable: false });
  }
  assert.equal(assessRecaptcha({ ...verified, score: 0.2 }, { ...verificationOptions, minimumScore: NaN }).ok, false);
  assert.deepEqual(assessRecaptcha({ success: false, "error-codes": ["timeout-or-duplicate"] }, verificationOptions), { ok: false, code: "recaptcha_expired", retryable: true });
});

test("expired token is refreshed once with the same idempotent lead ID", async () => {
  const requests = [];
  const result = await postLeadWithRetry({ token: "old", analytics: { leadId: "lead-12345" } }, {
    fetchImpl: async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return requests.length === 1
        ? Response.json({ code: "recaptcha_expired", retryable: true }, { status: 403 })
        : Response.json({ ok: true, leadId: "website-123" });
    },
    refreshToken: async () => "fresh",
  });
  assert.equal(result.ok, true);
  assert.deepEqual(requests.map((r) => r.token), ["old", "fresh"]);
  assert.equal(requests[0].analytics.leadId, requests[1].analytics.leadId);
});

test("failed submission cannot become a success or an unbounded retry", async () => {
  let attempts = 0;
  await assert.rejects(postLeadWithRetry({}, {
    fetchImpl: async () => { attempts++; return Response.json({ code: "recaptcha_expired", retryable: true }, { status: 403 }); },
    refreshToken: async () => "new-token",
  }), (error) => error.code === "recaptcha_expired");
  assert.equal(attempts, 2);
  await assert.rejects(postLeadWithRetry({}, {
    fetchImpl: async () => Response.json({ code: "recaptcha_score" }, { status: 403 }),
    refreshToken: () => assert.fail("must not retry a score rejection"),
  }));
  await assert.rejects(postLeadWithRetry({}, { fetchImpl: async () => Response.json({}) }));
});

test("the CT tube selection excludes accessories and other modalities", () => {
  for (const Name of ["CT X-Ray Tube Assembly", "DURA 688 CT Tube", "MX240 Tube"]) {
    assert.equal(isCtTubeProduct({ Name, Modality: "CT" }), true);
  }
  for (const Name of ["Tube Power Cable", "Tube Fan", "Tube Hoist", "Tube Gasket", "Tube Cooling Pump", "Detector Module"]) {
    assert.equal(isCtTubeProduct({ Name, Modality: "CT", Description: "CT tube" }), false);
  }
  assert.equal(isCtTubeProduct({ Name: "Tube", Modality: "MRI" }), false);
  assert.equal(cleanCatalogProductName({ Name: "120VAC {} POWER IF BOARD" }), "120VAC POWER IF BOARD");
});

test("hyphenated part numbers use a complete indexed lookup from either box", () => {
  const product = { PN: "PX72-07040-2", Name: "Power module" };
  const fields = buildCatalogSearchFields(product);
  const plans = getCatalogLookupPlans({ name: "px72 07040 2" });
  assert.deepEqual(plans[0], { field: "PNPrefixes", value: "PX72070402" });
  assert.ok(fields.PNPrefixes.includes(plans[0].value));
  assert.ok(getGeneralCatalogSearchScore(product, "PX72 07040 2") > 0);
  assert.deepEqual(getCatalogLookupPlans({ partNumber: "px72-07040-2" }), [plans[0]]);
  assert.deepEqual(getCatalogLookupPlans({ name: "x" }), []);
});

test("no-result sourcing carries context without fabricating an inventory match", () => {
  const url = new URL(buildPartSourcingHref({ partNumber: "PX72-07040-2", oem: "Toshiba" }), "https://advancedimagingparts.com");
  assert.equal(url.pathname, "/contact");
  assert.equal(url.searchParams.get("inquiry"), "parts");
  assert.equal(url.searchParams.get("pn"), "PX72-07040-2");
  assert.match(url.searchParams.get("message"), /Toshiba/);
  const general = new URL(buildPartSourcingHref({ query: "united imaging" }), url.origin);
  assert.equal(general.searchParams.get("inquiry"), "general");
  assert.equal(general.searchParams.has("pn"), false);
});

test("contact inference classifies trailers without adding hidden phone requirements", () => {
  assert.equal(inferLeadFormType("contact_form", "I need an MRI trailer rental"), "trailer_request");
  assert.equal(requiresContactPhone("contact_form"), false);
  assert.equal(requiresContactPhone("trailer_request"), true);
  assert.equal(inferLeadFormType("contact_form", "We offer cleaning services"), "contact_form");
  assert.equal(inferLeadFormType("contact_form", "MRI scanner repair"), "service_request");
  assert.equal(inferLeadFormType("part_request", "MRI trailer part"), "part_request");
});

test("analytics masks contact details but does not redact a substring inside long part IDs", () => {
  assert.equal(redactAnalyticsText("453566502751"), "453566502751");
  assert.equal(redactAnalyticsText("PX72-07040-2"), "PX72-07040-2");
  assert.equal(redactAnalyticsText("Call 5595376851"), "Call [redacted-phone]");
  assert.equal(redactAnalyticsText("(559) 537-6851"), "[redacted-phone]");
  assert.equal(redactAnalyticsText("person@example.com"), "[redacted-email]");
  const url = new URL(analyticsPageUrl("https://advancedimagingparts.com/contact?message=private&pn=123&utm_source=google&gclid=click-id#request"));
  assert.equal(url.searchParams.get("gclid"), "click-id");
  assert.equal(url.searchParams.get("utm_source"), "google");
  assert.equal(url.searchParams.has("message"), false);
  assert.equal(url.searchParams.has("pn"), false);
});
