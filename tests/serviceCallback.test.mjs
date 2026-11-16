import assert from "node:assert/strict";
import test from "node:test";
import { buildLeadEmailHtml, buildLeadText, sanitizeLeadForm, sanitizeServiceCallback } from "../components/utils/formSecurity.js";

const callback = { name: "Li", callbackPhone: "(202) 555-0148 ext. 316" };

test("a service callback accepts a dialable switchboard number and does not require an email or issue", () => {
  const { sanitized, errors } = sanitizeServiceCallback(callback);
  assert.deepEqual(errors, []);
  assert.equal(sanitized.callbackPhone, callback.callbackPhone);
  const details = { ...sanitized, leadType: "MRI service callback" };
  for (const message of [buildLeadText(details), buildLeadEmailHtml(details)]) {
    assert.ok(message.includes("MRI service callback"));
    assert.ok(message.includes(callback.callbackPhone));
    assert.doesNotMatch(message, /Email( Address)?:/i);
  }
  assert.ok(sanitizeLeadForm({ name: "Facility team", message: "Request support." }).errors.some(error => /email/.test(error)));
});

test("callback validation handles international numbers and rejects malformed numbers, names and optional emails", () => {
  const international = sanitizeServiceCallback({ ...callback, callbackPhone: "+44 20 7946 0200", email: "OPS@example.invalid", message: "<scanner>" });
  assert.deepEqual(international.errors, []);
  assert.equal(international.sanitized.email, "ops@example.invalid");
  const html = buildLeadEmailHtml(international.sanitized);
  assert.ok(html.includes("&lt;scanner&gt;") && html.includes("ops@example.invalid"));
  for (const invalid of ["", "555-0148", "2025550148 extra text", "2025550148\next. 12", "1".repeat(51)]) {
    assert.ok(sanitizeServiceCallback({ ...callback, callbackPhone: invalid }).errors.length);
  }
  assert.ok(sanitizeServiceCallback({ ...callback, name: " " }).errors.length);
  assert.ok(sanitizeServiceCallback({ ...callback, email: "incorrect" }).errors.length);
});
