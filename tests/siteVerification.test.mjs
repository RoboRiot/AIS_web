import test from "node:test";
import assert from "node:assert/strict";
import { verificationRequest } from "../scripts/lib/site-verification.mjs";

test("release checks reject stale and unlabeled page bodies but allow early redirects", async (t) => {
  const oldExpected = process.env.AIS_EXPECTED_RELEASE;
  process.env.AIS_EXPECTED_RELEASE = "candidate-123";
  t.after(() => { if (oldExpected === undefined) delete process.env.AIS_EXPECTED_RELEASE; else process.env.AIS_EXPECTED_RELEASE = oldExpected; });
  let next;
  t.mock.method(globalThis, "fetch", async () => next);
  next = new Response("page", { headers: { "x-ais-release": "old-123" } });
  await assert.rejects(verificationRequest("http://localhost"), /wrong or missing release/);
  next = new Response("page");
  await assert.rejects(verificationRequest("http://localhost"), /wrong or missing release/);
  next = new Response(null, { status: 308, headers: { location: "/contact" } });
  assert.equal((await verificationRequest("http://localhost")).status, 308);
  next = new Response("page", { headers: { "x-ais-release": "candidate-123" } });
  assert.equal((await verificationRequest("http://localhost")).status, 200);
});
