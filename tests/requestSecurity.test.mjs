import assert from "node:assert/strict";
import test from "node:test";

import {
  CATALOG_REQUEST_HEADER,
  CATALOG_REQUEST_VALUE,
} from "../app/data/catalogRequestPolicy.mjs";
import {
  consumeRateLimits,
  getRateLimitFingerprint,
  isTrustedCatalogRequest,
} from "../app/data/requestSecurity.js";

const requestWith = (values = {}) => ({
  headers: new Headers(values),
});

const browserRequest = (overrides = {}) => requestWith({
  accept: "application/json",
  host: "advancedimagingparts.com",
  "sec-fetch-site": "same-origin",
  "user-agent": "Mozilla/5.0 Chrome/140.0 Safari/537.36",
  [CATALOG_REQUEST_HEADER]: CATALOG_REQUEST_VALUE,
  ...overrides,
});

class FakeRateLimitDb {
  constructor() {
    this.documents = new Map();
  }

  collection(name) {
    assert.equal(name, "WebsiteRateLimits");
    return { doc: (id) => ({ id }) };
  }

  async runTransaction(callback) {
    const writes = [];
    const transaction = {
      get: async (reference) => ({
        data: () => this.documents.get(reference.id) || {},
      }),
      set: (reference, data) => writes.push([reference.id, data]),
    };
    const result = await callback(transaction);
    writes.forEach(([id, data]) => {
      this.documents.set(id, { ...(this.documents.get(id) || {}), ...data });
    });
    return result;
  }
}

test("requires the catalog marker and JSON response type", () => {
  assert.equal(isTrustedCatalogRequest(browserRequest()), true);
  assert.equal(
    isTrustedCatalogRequest(browserRequest({ [CATALOG_REQUEST_HEADER]: "" })),
    false,
  );
  assert.equal(isTrustedCatalogRequest(browserRequest({ accept: "text/html" })), false);
});

test("rejects cross-site and untrusted-origin catalog requests", () => {
  assert.equal(
    isTrustedCatalogRequest(browserRequest({ "sec-fetch-site": "cross-site" })),
    false,
  );
  assert.equal(
    isTrustedCatalogRequest(browserRequest({ origin: "https://example.net" })),
    false,
  );
  assert.equal(
    isTrustedCatalogRequest(
      browserRequest({ origin: "https://advancedimagingparts.com" }),
    ),
    true,
  );
});

test("IP rate-limit fingerprints cannot be reset by rotating user agents", () => {
  const first = browserRequest({
    "x-appengine-user-ip": "203.0.113.10",
    "user-agent": "Browser A",
  });
  const rotated = browserRequest({
    "x-appengine-user-ip": "203.0.113.10",
    "user-agent": "Browser B",
  });
  const otherIp = browserRequest({
    "x-appengine-user-ip": "203.0.113.11",
    "user-agent": "Browser A",
  });

  assert.equal(
    getRateLimitFingerprint(first, "parts-search", "ip"),
    getRateLimitFingerprint(rotated, "parts-search", "ip"),
  );
  assert.notEqual(
    getRateLimitFingerprint(first, "parts-search", "ip"),
    getRateLimitFingerprint(otherIp, "parts-search", "ip"),
  );
});

test("layered limits block the shared IP when any window is exhausted", async () => {
  const db = new FakeRateLimitDb();
  const policies = [
    { name: "burst", scope: "ip", limit: 2, windowMs: 10_000 },
    { name: "minute", scope: "ip", limit: 5, windowMs: 60_000 },
  ];
  const firstAgent = browserRequest({
    "x-appengine-user-ip": "203.0.113.10",
    "user-agent": "Browser A",
  });
  const rotatedAgent = browserRequest({
    "x-appengine-user-ip": "203.0.113.10",
    "user-agent": "Browser B",
  });

  const first = await consumeRateLimits({
    db,
    request: firstAgent,
    namespace: "parts-search-test",
    policies,
    now: 120_000,
  });
  const second = await consumeRateLimits({
    db,
    request: rotatedAgent,
    namespace: "parts-search-test",
    policies,
    now: 120_000,
  });
  const blocked = await consumeRateLimits({
    db,
    request: firstAgent,
    namespace: "parts-search-test",
    policies,
    now: 120_000,
  });

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.deepEqual(blocked, { allowed: false, retryAfterSeconds: 10 });
});
