import test from "node:test";
import assert from "node:assert/strict";
import { summarizeGoogleTagHealth } from "../app/data/googleTagHealth.mjs";

const status = (state, sequence, extra = {}) => ({
  eventType: "google_tag_status", path: "/contact",
  properties: { tag_load_id: "document-a", tag_load_sequence: sequence, tag_state: state, ...extra },
});

test("retries and SPA paths are one load, ordered even when server writes arrive out of order", () => {
  const result = summarizeGoogleTagHealth([
    status("loaded", 4, { tag_load_final: true }),
    status("failed", 2, { tag_load_error: "script_error" }),
    { ...status("queued", 3), path: "/trailers" },
    status("queued", 1),
    { eventType: "form_submit" },
  ]);
  assert.equal(result.rawObservations, 4);
  assert.equal(result.observedLoadGroups, 1);
  assert.equal(result.loaded, 1);
  assert.equal(result.recovered, 1);
  assert.equal(result.finalFailed, 0);
});

test("incomplete retries, final errors, and offline waits are distinct", () => {
  const rows = [
    { tag_state: "failed", tag_load_final: false, tag_load_error: "script_error" },
    { tag_state: "failed", tag_load_final: true, tag_load_error: "script_error" },
    { tag_state: "queued", tag_load_error: "offline" },
    { tag_state: "queued", tag_load_error: "load_timeout" },
  ].map((props, index) => ({ eventType: "google_tag_status", properties: { ...props, tag_load_id: `doc-${index}` } }));
  const result = summarizeGoogleTagHealth(rows);
  assert.equal(result.unresolvedError, 1);
  assert.equal(result.finalFailed, 1);
  assert.equal(result.offlinePending, 1);
  assert.equal(result.pending, 1);
});

test("legacy observations are explicitly approximate and unidentified events stay separate", () => {
  const legacy = (time, state, attempts) => ({
    eventType: "google_tag_status", sessionHash: "session-a", path: "/contact",
    clientOccurredAt: `2026-10-20T10:00:0${time}Z`,
    properties: { tag_state: state, tag_load_attempts: attempts, tag_load_error: "script_error" },
  });
  const result = summarizeGoogleTagHealth([
    legacy(2, "failed", 1), legacy(4, "loaded", 2), legacy(1, "queued", 1),
    { ...legacy(3, "failed", 3), path: "/parts" },
    { eventType: "google_tag_status" }, { eventType: "google_tag_status" },
  ]);
  assert.equal(result.observedLoadGroups, 4);
  assert.equal(result.legacyGroups, 4);
  assert.equal(result.recovered, 1);
  assert.equal(result.finalFailed, 1);
  assert.equal(result.unknown, 2);
});
