import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as nodeCrypto from "node:crypto";
import * as nextServer from "next/server.js";

// Exercise the real route with isolated in-memory persistence and transport.
// The normal test command re-enters only this suite with Node's VM flag.
if (!vm.SourceTextModule) {
  test("detailed service acceptance and measurement recovery integration", () => {
    execFileSync(process.execPath, ["--experimental-vm-modules", "--test", fileURLToPath(import.meta.url)],
      { encoding: "utf8", timeout: 30000, stdio: ["ignore", "pipe", "pipe"] });
  });
} else {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const origin = "https://advancedimagingparts.com";
  const reference = "synthetic_service_recovery";
  class Time {
    constructor(ms) { this.ms = ms; }
    toMillis() { return this.ms; }
    toDate() { return new Date(this.ms); }
  }
  const clone = (value) => value instanceof Time ? new Time(value.ms)
    : Array.isArray(value) ? value.map(clone)
      : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)])) : value;

  async function fixture(options = {}) {
    const docs = new Map(), files = new Map(), sent = [], deleted = [];
    const capturedTime = Date.now();
    let queue = Promise.resolve(), attemptedCreate = false;
    const serial = (fn) => { const result = queue.then(fn); queue = result.catch(() => {}); return result; };
    const snapshot = (ref) => {
      const value = clone(docs.get(ref.path));
      return { exists: value !== undefined, data: () => clone(value),
        get: (key) => key.split(".").reduce((result, part) => result?.[part], value) };
    };
    const resolve = (prior, value) => {
      if (value?.operation === "increment") return (prior || 0) + value.amount;
      if (value?.operation === "serverTimestamp") return new Time(capturedTime);
      if (value instanceof Time) return clone(value);
      if (Array.isArray(value)) return value.map((v) => resolve(undefined, v));
      if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(prior?.[k], v)]));
      return value;
    };
    const mergeFields = (prior, value) => value && typeof value === "object" && !(value instanceof Time) && !Array.isArray(value)
      ? { ...prior, ...Object.fromEntries(Object.entries(value).map(([key, next]) => [key, mergeFields(prior?.[key], next)])) }
      : value;
    const apply = (ref, values, merge = false, update = false) => {
      const prior = clone(docs.get(ref.path)) || {};
      if (!update) { docs.set(ref.path, merge ? mergeFields(prior, resolve(prior, values)) : resolve(undefined, values)); return; }
      for (const [key, value] of Object.entries(values)) {
        const parts = key.split("."); let target = prior;
        for (const part of parts.slice(0, -1)) target = target[part] ||= {};
        if (value?.operation === "delete") delete target[parts.at(-1)];
        else target[parts.at(-1)] = resolve(target[parts.at(-1)], value);
      }
      docs.set(ref.path, prior);
    };
    const db = {
      collection: (name) => ({ doc(id) {
        const ref = { path: `${name}/${id}`, id };
        ref.get = async () => {
          if (attemptedCreate && options.failReadback) throw Error("fixture read unavailable");
          return snapshot(ref);
        };
        ref.create = (data) => serial(() => {
          attemptedCreate = true;
          if (docs.has(ref.path)) throw Object.assign(Error("already accepted"), { code: 6 });
          if (options.failBeforeCreate) throw Error("create unavailable");
          apply(ref, data);
          if (options.failAfterCreate) throw Error("response lost after acceptance");
        });
        return ref;
      } }),
      runTransaction: (fn) => serial(async () => {
        const writes = [];
        const result = await fn({
          get: async (ref) => {
            if (options.failEventRead && ref.path.startsWith("WebsiteAnalyticsEvents/")) throw Error("event read unavailable");
            return snapshot(ref);
          },
          set: (ref, value, config) => writes.push(() => apply(ref, value, config?.merge)),
          update: (ref, value) => writes.push(() => apply(ref, value, false, true)),
        });
        if (options.failAnalytics && writes.length && attemptedCreate &&
            [...docs.keys()].some((k) => k.startsWith("ServiceRequests/"))) {
          // Failure occurs after transaction reads and before any measurement writes.
          throw Error("analytics unavailable");
        }
        writes.forEach((write) => write());
        return result;
      }),
    };
    const bucket = { file: (key) => ({ save: async (buffer) => files.set(key, Buffer.from(buffer)),
      delete: async () => { deleted.push(key); files.delete(key); } }) };
    const env = { NODE_ENV: "production", RECAPTCHA_SECRET_KEY: "fixture-only", ANALYTICS_HASH_SALT: "fixture-only",
      FIREBASE_SERVICE_ACCOUNT_JSON: "{}", OPENAI_CONVERSIONS_API_KEY: "fixture-only" };
    const context = vm.createContext({ Buffer, URL, URLSearchParams, Request, Response, Headers, AbortSignal,
      setTimeout, clearTimeout, process: { env }, console: { error() {}, warn() {} },
      fetch: async (url, request) => {
        if (String(url) === "https://www.google.com/recaptcha/api/siteverify") {
          return Response.json({ success: true, score: 0.9, action: "service_request", hostname: "advancedimagingparts.com" });
        }
        assert.equal(new URL(url).origin, "https://bzr.openai.com");
        assert.equal(new URL(url).pathname, "/v1/events");
        assert.ok([...docs.keys()].some((key) => key.startsWith("ServiceRequests/")));
        const payload = JSON.parse(request.body); sent.push(payload);
        return Response.json({ accepted_events: 1 });
      } });
    const external = new Map([
      ["node:crypto", nodeCrypto], ["next/server", nextServer],
      ["firebase-admin/app", { cert: () => ({}), getApps: () => [{}], initializeApp() {} }],
      ["firebase-admin/storage", { getStorage: () => ({ bucket: () => bucket }) }],
      ["firebase-admin/firestore", { getFirestore: () => db, Timestamp: { fromMillis: (ms) => new Time(ms) },
        FieldValue: { serverTimestamp: () => ({ operation: "serverTimestamp" }),
          increment: (amount) => ({ operation: "increment", amount }), delete: () => ({ operation: "delete" }) } }],
    ]);
    const cache = new Map();
    async function load(specifier, parent = path.join(root, "entry.mjs")) {
      if (external.has(specifier)) {
        if (!cache.has(specifier)) {
          const values = external.get(specifier);
          cache.set(specifier, new vm.SyntheticModule(Object.keys(values), function () {
            for (const [key, value] of Object.entries(values)) this.setExport(key, value);
          }, { context, identifier: specifier }));
        }
        return cache.get(specifier);
      }
      let file = specifier.startsWith("@/") ? path.join(root, specifier.slice(2)) : path.resolve(path.dirname(parent), specifier);
      if (!path.extname(file)) file += ".js";
      assert.ok(file.startsWith(root + path.sep));
      if (!cache.has(file)) cache.set(file, new vm.SourceTextModule(fs.readFileSync(file, "utf8"), { context, identifier: file }));
      return cache.get(file);
    }
    const route = await load("./app/api/service-requests/route.js");
    await route.link((specifier, parent) => load(specifier, parent.identifier)); await route.evaluate();
    const records = (name) => [...docs.entries()].filter(([key]) => key.startsWith(name + "/"));
    const submit = async (changes = {}, attachment = false) => {
      const analytics = { leadId: "service-recovery-fixture-0001", sourcePage: "/service-request", landing_path: "/services/mri-service",
        acquisition_source: "paid_search", utm_source: "chatgpt", utm_campaign: "original-campaign", oppref: reference,
        measurement: { eligibility: "eligible", marketingConsent: "granted" }, ...changes.analytics };
      const values = { action: "service_request", token: "fixture-token", startedAt: Date.now() - 5000,
        companyName: "Fixture facility", requestedServiceDate: "2026-11-19", streetAddress: "1 Test Street",
        city: "Test City", region: "CA", postalCode: "90001", country: "US", urgency: "soon",
        manufacturer: "GE Healthcare", modality: "MRI", firstName: "Fixture", lastName: "Person",
        phone: "2025550148", email: "fixture@example.invalid", issueTitle: "MRI service", description: "MRI scanner repair",
        ...changes, analytics: JSON.stringify(analytics) };
      const form = new FormData(); for (const [key, value] of Object.entries(values)) form.set(key, String(value));
      if (attachment) form.append("files", new Blob(["fixture log"], { type: "text/plain" }), "fixture.txt");
      const response = await route.namespace.POST(new Request(origin + "/api/service-requests", {
        method: "POST", body: form, headers: { origin, host: "advancedimagingparts.com", "sec-fetch-site": "same-origin",
          "user-agent": "Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36", "x-forwarded-for": "203.0.113.42" },
      }));
      return { status: response.status, body: await response.json() };
    };
    return { options, docs, files, sent, deleted, submit, records };
  }

  test("accepted request survives measurement failure; retry restores original event, date, source and conversion once", async () => {
    const f = await fixture({ failAnalytics: true });
    assert.equal((await f.submit({}, true)).status, 201);
    assert.equal(f.records("ServiceRequests").length, 1); assert.equal(f.records("WebsiteAnalyticsEvents").length, 0);
    const original = clone(f.records("ServiceRequests")[0][1]);
    assert.ok(original.analytics.openAiConversion); assert.equal(f.files.size, 1);
    f.options.failAnalytics = false;
    const retry = await f.submit({ issueTitle: "Rent mobile CT trailer", analytics: { utm_campaign: "changed", acquisition_source: "direct" } });
    assert.equal(retry.status, 200); assert.equal(retry.body.duplicate, true); assert.equal(retry.body.formType, "service_request");
    const event = f.records("WebsiteAnalyticsEvents")[0][1];
    assert.equal(event.utm.campaign, "original-campaign"); assert.equal(event.acquisitionSource, "paid_search");
    assert.equal(event.createdAt.toMillis(), original.createdAt.toMillis());
    assert.equal(event.date, new Date(original.analytics.acceptedAtMs).toISOString().slice(0, 10));
    assert.equal(event.openAiConversion.event.timestamp_ms, original.analytics.openAiConversion.event.timestamp_ms);
    assert.equal(f.sent.length, 1); assert.equal(f.files.size, 1);
    assert.equal(f.records("ServiceRequests")[0][1].analytics.openAiConversion, undefined);
    const before = clone(event); await f.submit();
    assert.deepEqual(f.records("WebsiteAnalyticsEvents")[0][1], before);
    assert.equal(f.records("WebsiteAnalyticsDaily")[0][1].totals.form_submit, 1); assert.equal(f.sent.length, 1);
  });

  test("a retry cannot grant original consent or replace the original click reference", async () => {
    for (const originalConsent of ["denied", "granted"]) {
      const f = await fixture({ failAnalytics: true });
      await f.submit({ analytics: { measurement: { eligibility: "eligible", marketingConsent: originalConsent } } });
      f.options.failAnalytics = false;
      await f.submit({ analytics: { oppref: "different_click" } });
      assert.equal(f.sent.length, 0);
      assert.equal(f.records("WebsiteAnalyticsEvents")[0][1].measurement.marketingConsent, originalConsent);
    }
  });

  test("withdrawal defers a valid original seed and later matching consented retry can deliver it", async () => {
    const f = await fixture({ failAnalytics: true }); await f.submit(); f.options.failAnalytics = false;
    await f.submit({ analytics: { measurement: { eligibility: "eligible", marketingConsent: "denied" } } });
    assert.equal(f.sent.length, 0); assert.equal(f.records("WebsiteAnalyticsEvents")[0][1].openAiConversion.status, "pending");
    await f.submit(); assert.equal(f.sent.length, 1);
  });

  test("legacy repair uses original timestamp and metadata, never a retry's consent or reference", async () => {
    const f = await fixture({ failAnalytics: true });
    await f.submit({ analytics: { measurement: { eligibility: "eligible", marketingConsent: "denied" } } });
    const original = f.records("ServiceRequests")[0][1];
    delete original.analytics.productionEligible; delete original.analytics.acceptedAtMs; delete original.analytics.openAiConversion;
    original.createdAt = new Time(Date.now() - 2 * 86400000);
    f.options.failAnalytics = false; await f.submit();
    const event = f.records("WebsiteAnalyticsEvents")[0][1];
    assert.equal(event.productionVerification, "legacy_unknown"); assert.equal(event.createdAt.toMillis(), original.createdAt.toMillis());
    assert.equal(event.measurement.marketingConsent, "denied"); assert.equal(event.openAiConversion, undefined); assert.equal(f.sent.length, 0);
  });

  test("recovery preserves earlier milestones and qualification, and uses the original acceptance day", async () => {
    const f = await fixture({ failAnalytics: true }); await f.submit();
    const [requestPath, original] = f.records("ServiceRequests")[0];
    const priorDay = Date.now() - 2 * 86400000;
    original.analytics.acceptedAtMs = priorDay; original.createdAt = new Time(priorDay);
    original.analytics.openAiConversion.event.timestamp_ms = priorDay;
    const hash = requestPath.split("/web-")[1];
    f.docs.set("WebsiteLeadFunnels/" + hash, { qualificationStatus: "qualified", milestones: { form_open: true, form_start: true },
      milestoneDates: { form_open: "original-open-date" }, createdAt: new Time(priorDay - 5000) });
    f.options.failAnalytics = false; await f.submit();
    const funnel = f.records("WebsiteLeadFunnels")[0][1];
    assert.deepEqual(funnel.milestones, { form_open: true, form_start: true, form_submit: true });
    assert.equal(funnel.qualificationStatus, "qualified"); assert.equal(funnel.milestoneDates.form_open, "original-open-date");
    assert.equal(funnel.createdAt.toMillis(), priorDay - 5000);
    assert.equal(f.records("WebsiteAnalyticsDaily")[0][0], "WebsiteAnalyticsDaily/" + new Date(priorDay).toISOString().slice(0, 10));
    assert.equal(f.records("WebsiteAnalyticsEvents")[0][1].openAiConversion.event.timestamp_ms, priorDay);
  });

  test("original nonproduction eligibility cannot become production through a retry", async () => {
    const f = await fixture({ failAnalytics: true }); await f.submit();
    const original = f.records("ServiceRequests")[0][1]; original.analytics.productionEligible = false;
    f.options.failAnalytics = false; await f.submit();
    assert.equal(f.records("WebsiteAnalyticsEvents").length, 0); assert.equal(f.sent.length, 0);
  });

  test("concurrent submissions create one accepted request, retained attachment, counter and conversion", async () => {
    const f = await fixture(); const results = await Promise.all([f.submit({}, true), f.submit({}, true)]);
    assert.deepEqual(results.map((v) => v.status).sort(), [200, 201]);
    assert.equal(f.records("ServiceRequests").length, 1); assert.equal(f.files.size, 1);
    assert.equal(f.records("WebsiteAnalyticsEvents").length, 1); assert.equal(f.sent.length, 1);
    assert.equal(f.records("WebsiteAnalyticsDaily")[0][1].totals.form_submit, 1);
    const saved = f.records("ServiceRequests")[0][1]; assert.ok(f.files.has(saved.files[0].storagePath));
  });

  test("ambiguous accepted creation and later read failures never delete possibly accepted attachments", async () => {
    const confirmed = await fixture({ failAfterCreate: true });
    assert.equal((await confirmed.submit({}, true)).status, 200); assert.equal(confirmed.files.size, 1);
    const uncertain = await fixture({ failAfterCreate: true, failReadback: true });
    assert.equal((await uncertain.submit({}, true)).status, 500);
    assert.equal(uncertain.records("ServiceRequests").length, 1); assert.equal(uncertain.files.size, 1); assert.equal(uncertain.deleted.length, 0);
    uncertain.options.failReadback = false; uncertain.options.failAfterCreate = false;
    assert.equal((await uncertain.submit()).status, 200); assert.equal(uncertain.files.size, 1);
  });

  test("definitely unaccepted creation cleans its upload; accepted measurement read errors retain it", async () => {
    const failed = await fixture({ failBeforeCreate: true });
    assert.equal((await failed.submit({}, true)).status, 500); assert.equal(failed.files.size, 0);
    const accepted = await fixture({ failEventRead: true });
    assert.equal((await accepted.submit({}, true)).status, 201); assert.equal(accepted.files.size, 1);
  });
}
