import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createAttributionReader, resolveAttribution } from "../app/data/browserAttribution.mjs";
import { createLeadEventDispatcher, ensureGoogleAnalytics } from "../app/data/browserGoogleAnalytics.mjs";
import { createFormSession, validFormTiming } from "../app/data/formTiming.mjs";
import { postLeadWithRetry } from "../app/data/leadSubmission.mjs";
import { buildLegacyProductAliases, matchesLegacyProduct } from "../app/data/legacyProductAliases.mjs";

const origin = "https://advancedimagingparts.com";
const memoryStorage = () => {
  const data = new Map();
  return { getItem: (key) => data.get(key) || null, setItem: (key, value) => data.set(key, value) };
};
const blockedStorage = { getItem() { throw Error("blocked"); }, setItem() { throw Error("blocked"); } };

test("a later ad click replaces a same-tab organic source and follows the visitor to contact", () => {
  const read = createAttributionReader();
  const storage = memoryStorage();
  assert.equal(read({ href: `${origin}/parts`, referrer: "https://www.google.com/", storage, now: 1_000 }).acquisition_source, "google_organic");
  const paid = read({ href: `${origin}/trailers/mobile-ct-trailer-rental?gclid=test-click-123&utm_campaign=CT`, storage, now: 2_000 });
  assert.equal(paid.acquisition_source, "paid_search");
  const contact = read({ href: `${origin}/contact?message=private`, storage, now: 3_000 });
  assert.equal(contact.gclid, "test-click-123");
  assert.equal(contact.landing_path, "/trailers/mobile-ct-trailer-rental");
  assert.equal(contact.utm_campaign, "CT");
  assert.equal(contact.observed_at, undefined);
});

test("storage errors do not discard paid attribution during client navigation", () => {
  const read = createAttributionReader();
  read({ href: `${origin}/trailers?gbraid=test-braid`, storage: blockedStorage });
  assert.equal(read({ href: `${origin}/contact`, storage: blockedStorage }).gbraid, "test-braid");
});

test("expired attribution and a fresh organic entry are not reported as paid", () => {
  const paid = resolveAttribution({ href: `${origin}/trailers?gclid=test-click`, now: 1_000 });
  assert.equal(resolveAttribution({ href: `${origin}/contact`, previous: paid, now: 2_000_000 }).acquisition_source, "direct");
  assert.equal(resolveAttribution({ href: `${origin}/parts`, referrer: "https://www.google.com/", previous: paid, entry: true, now: 2_000 }).acquisition_source, "google_organic");
  assert.equal(resolveAttribution({ href: `${origin}/contact?gclid=invalid%20click` }).click_id_present, false);
});

test("lead queue recovers an accepted duplicate response once, including after reload", () => {
  const storage = memoryStorage();
  const browser = { location: new URL(`${origin}/contact?message=private`) };
  const gtag = ensureGoogleAnalytics(browser, "G-TEST");
  const dispatch = createLeadEventDispatcher();
  const properties = { lead_id: "accepted-server-hash", form_type: "trailer_request" };
  assert.equal(dispatch({ gtag, properties, storage }), true);
  assert.equal(dispatch({ gtag, properties, storage }), false);
  assert.equal(createLeadEventDispatcher()({ gtag, properties, storage }), false);
  assert.equal(browser.dataLayer.filter((args) => args[1] === "generate_lead").length, 1);
  assert.equal(browser.dataLayer.filter((args) => args[1] === "generate_trailer_lead").length, 1);
  assert.equal(browser.dataLayer[1][1], "G-TEST");
  assert.equal(browser.dataLayer[1][2].page_location, `${origin}/contact`);
});

test("a synchronous dispatch error does not permanently suppress retry", () => {
  const dispatch = createLeadEventDispatcher();
  const properties = { lead_id: "accepted-lead", form_type: "contact_form" };
  assert.throws(() => dispatch({ gtag: () => { throw Error("not ready"); }, properties }));
  assert.equal(dispatch({ gtag() {}, properties, storage: blockedStorage }), true);
  assert.equal(dispatch({ gtag() {}, properties, storage: blockedStorage }), false);
});

test("signed recovery uses server time and rejects tampering, premature, expired or mismatched submissions", () => {
  const input = { formType: "trailer_request", leadId: "test-lead-123", secret: "test-only-secret", now: 1_000_000 };
  const formSession = createFormSession(input);
  const submission = { ...input, formSession, startedAt: -5, now: input.now + 2_600 };
  assert.equal(validFormTiming(submission), true);
  for (const change of [{ now: input.now + 2_499 }, { now: input.now + 86_400_001 },
    { leadId: "different-lead" }, { formType: "contact_form" }, { secret: "wrong-secret" },
    { formSession: `${formSession}x` }, { formSession: "invalid" }]) {
    assert.equal(validFormTiming({ ...submission, ...change }), false);
  }
  assert.equal(validFormTiming({ startedAt: 1_000, now: 5_000 }), true);
  assert.equal(validFormTiming({ startedAt: NaN, now: 5_000 }), false);
});

test("stale form recovery preserves fields and ID and waits before retry with a fresh token", async () => {
  const requests = [];
  const waits = [];
  const payload = { formType: "trailer_request", token: "old", name: "QA", message: "unchanged", analytics: { leadId: "lead-12345" } };
  const result = await postLeadWithRetry(payload, {
    fetchImpl: async (url, options) => {
      const body = JSON.parse(options.body);
      requests.push({ url, body });
      if (url.endsWith("/session")) return Response.json({ ok: true, formSession: "signed-session", waitMs: 2_600 });
      return requests.length === 1
        ? Response.json({ code: "form_timing", retryable: true }, { status: 403 })
        : Response.json({ ok: true, duplicate: true, analyticsLeadId: "server-hash" });
    },
    refreshToken: async () => "fresh", wait: async (ms) => waits.push(ms),
  });
  assert.equal(result.ok, true);
  assert.deepEqual(waits, [2_600]);
  assert.deepEqual(requests[2].body, { ...payload, token: "fresh", formSession: "signed-session" });
  assert.deepEqual(requests[1].body, { formType: "trailer_request", leadId: "lead-12345" });
});

test("timing recovery is bounded and never retries honeypot decisions", async () => {
  let posts = 0;
  await assert.rejects(postLeadWithRetry({ formType: "part_request", analytics: { leadId: "lead-12345" } }, {
    fetchImpl: async (url) => url.endsWith("/session")
      ? Response.json({ ok: true, formSession: "signed", waitMs: 2_600 })
      : (posts++, Response.json({ code: "form_timing", retryable: true }, { status: 403 })),
    refreshToken: async () => "fresh", wait: async () => {},
  }), (error) => error.code === "form_timing");
  assert.equal(posts, 2);
  await assert.rejects(postLeadWithRetry({}, {
    fetchImpl: async () => Response.json({ code: "honeypot" }, { status: 403 }),
    refreshToken: () => assert.fail("no spam retry"),
  }), (error) => error.code === "honeypot");
});

test("multipart service retry preserves attachments and accepted ID", async () => {
  const payload = new FormData();
  payload.set("token", "old");
  payload.set("files", new Blob(["sample log"], { type: "text/plain" }), "sample.txt");
  let posts = 0;
  await postLeadWithRetry(payload, {
    endpoint: "/api/service-requests", formType: "service_request", leadId: "lead-12345",
    fetchImpl: async (url, options) => {
      assert.equal(url, "/api/service-requests");
      assert.equal(options.headers, undefined);
      assert.equal(await options.body.get("files").text(), "sample log");
      return ++posts === 1
        ? Response.json({ code: "recaptcha_expired", retryable: true }, { status: 403 })
        : Response.json({ ok: true, analyticsLeadId: "same-server-hash" });
    }, refreshToken: async () => "fresh",
  });
  assert.equal(payload.get("token"), "fresh");
});

test("legacy names resolve only unique historical IDs with the same part number", async () => {
  const parts = JSON.parse(await readFile(new URL("../public/assets/data/parts.json", import.meta.url), "utf8"));
  const aliases = buildLegacyProductAliases(parts);
  for (const [slug, id] of [["2-hd-nv-array", "d71a15d4d849"], ["terminal-servrer-pwr-supply", "4a864487dab0"],
    ["lightspeed-performix-40-plus-ct-tube-liquid-bearing", "temp-204"]]) {
    assert.equal(aliases.get(slug).id, id);
    assert.equal(matchesLegacyProduct(aliases.get(slug), parts.find((p) => p.id === id)), true);
  }
  const duplicate = buildLegacyProductAliases([{ id: "a", Name: "Coil", PN: "123" }, { id: "b", Name: "Coil", PN: "456" }]);
  assert.equal(duplicate.get("coil"), null);
  assert.equal(matchesLegacyProduct({ id: "a", partNumber: "123" }, { id: "a", PN: "456" }), false);
});
