import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { BUSINESS_PHONE, BUSINESS_PHONE_E164, BUSINESS_PHONE_HREF, SUPPORT_PHONE, SUPPORT_PHONE_E164, SUPPORT_PHONE_HREF } from "../app/data/businessContact.mjs";
import * as tracking from "../app/data/websiteCallTracking.mjs";

test("new inquiries and existing customers have distinct public numbers", () => {
  assert.equal(BUSINESS_PHONE, "(559) 537-6851");
  assert.equal(BUSINESS_PHONE_E164, "+15595376851");
  assert.equal(SUPPORT_PHONE, "(800) 200-3583");
  assert.equal(SUPPORT_PHONE_E164, "+18002003583");
  assert.equal(SUPPORT_PHONE_HREF, `tel:${SUPPORT_PHONE_E164}`);
  assert.equal(BUSINESS_PHONE_HREF, `tel:${BUSINESS_PHONE_E164}`);
  assert.equal(tracking.BUSINESS_PHONE, BUSINESS_PHONE);
  assert.equal(tracking.BUSINESS_PHONE_HREF, BUSINESS_PHONE_HREF);
});

test("application phone literals use only the approved public contact numbers", () => {
  const approved = new Set([BUSINESS_PHONE, BUSINESS_PHONE_E164, SUPPORT_PHONE, SUPPORT_PHONE_E164]);
  const inspect = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
      if (entry.isDirectory()) inspect(file);
      else if (/\.(?:js|jsx|mjs|json)$/.test(entry.name)) {
        const text = readFileSync(file, "utf8");
        for (const [number] of text.matchAll(/\(\d{3}\) \d{3}-\d{4}|\+1\d{10}\b/g)) {
          assert.ok(approved.has(number), `Unexpected phone literal in ${file.pathname}`);
        }
      }
    }
  };
  inspect(new URL("../app/", import.meta.url));
  inspect(new URL("../components/", import.meta.url));
});

test("forwarding replacement targets new customers and leaves support untouched", () => {
  const makeAnchor = (href, number) => ({
    href, isConnected: true, text: { nodeValue: number, isConnected: true },
    getAttribute(key) { return this[key] ?? null; },
    setAttribute(key, value) { this[key] = value; },
    removeAttribute(key) { delete this[key]; },
  });
  const sales = makeAnchor(BUSINESS_PHONE_HREF, BUSINESS_PHONE);
  const support = makeAnchor(SUPPORT_PHONE_HREF, SUPPORT_PHONE);
  const document = {
    querySelectorAll(selector) {
      return [sales, support].filter((anchor) => selector.includes(`href="${anchor.href}"`));
    },
    createTreeWalker(anchor) { let read = false; return { nextNode() { if (read) return null; read = true; return anchor.text; } }; },
  };
  const replacement = tracking.createPhoneNumberReplacement(document);
  replacement.apply({ text: "(800) 555-0123", href: "tel:+18005550123" });
  assert.equal(sales.href, "tel:+18005550123");
  assert.equal(support.href, SUPPORT_PHONE_HREF);
  assert.equal(support.text.nodeValue, SUPPORT_PHONE);
  assert.equal(tracking.getPhoneClickMeasurement({ element: support }).call_number_type, "existing_customer_number");
  replacement.restore();
  assert.equal(sales.href, BUSINESS_PHONE_HREF);
  assert.equal(support.href, SUPPORT_PHONE_HREF);
});
