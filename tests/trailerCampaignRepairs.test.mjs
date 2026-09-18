import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { inferLeadFormType } from "../app/data/leadIntent.mjs";
import { LEGACY_TRAILER_REDIRECTS } from "../app/data/seoRoutes.mjs";
import { trailerLandingPages } from "../app/data/serviceLandingPages.js";
import { createAttributionReader } from "../app/data/browserAttribution.mjs";
import { normalizeLeadAnalytics } from "../app/data/leadAnalytics.mjs";

test("general contact requests recognize explicit mobile rental intent without overriding chosen categories", () => {
  for (const message of ["Please quote CT rental", "We need MRI leasing", "Need to rent a CT scanner",
    "Interested in your trailers", "PET/CT lease for our hospital", "Can we lease an MRI?"]) {
    assert.equal(inferLeadFormType("contact_form", message), "trailer_request", message);
    assert.equal(inferLeadFormType("part_request", message), "part_request");
  }
  for (const message of ["CT scan appointment", "MRI part availability", "What is your address?"]) {
    assert.equal(inferLeadFormType("contact_form", message), "contact_form", message);
  }
});

test("historical trailer URLs permanently redirect only to existing trailer destinations", () => {
  const destinations = new Set(["/trailers", ...trailerLandingPages.map((page) => `/trailers/${page.slug}`)]);
  assert.equal(LEGACY_TRAILER_REDIRECTS.length, 4);
  assert.equal(new Set(LEGACY_TRAILER_REDIRECTS.map((route) => route.source)).size, 4);
  for (const route of LEGACY_TRAILER_REDIRECTS) {
    assert.ok(destinations.has(route.destination), route.destination);
    assert.equal(route.permanent, true);
    assert.notEqual(route.source, route.destination);
  }
});

test("campaign suffix and auto-tagged click survive trailer-to-contact navigation and reload", () => {
  const saved = new Map();
  const storage = { getItem: (key) => saved.get(key), setItem: (key, value) => saved.set(key, value) };
  const origin = "https://advancedimagingparts.com";
  const read = createAttributionReader();
  read({ href: `${origin}/trailers/mobile-ct-trailer-rental?utm_source=google&utm_medium=cpc&utm_campaign=ct_trailers&utm_id=campaign24133100082&utm_content=ad1234567890&utm_term=mobile%20ct%20rental&gclid=test-click-123`, storage, now: 1000 });
  read({ href: `${origin}/contact`, storage, now: 2000 });
  const reloaded = createAttributionReader()({ href: `${origin}/contact`, referrer: `${origin}/trailers`, storage, now: 3000 });
  const lead = normalizeLeadAnalytics(reloaded);
  assert.equal(lead.acquisitionSource, "paid_search");
  assert.equal(lead.clickIds.gclid, "test-click-123");
  assert.equal(lead.utm.id, "campaign24133100082");
  assert.equal(lead.utm.content, "ad1234567890");
  assert.equal(lead.utm.campaign, "ct_trailers");
  assert.equal(lead.landingPath, "/trailers/mobile-ct-trailer-rental");
});

test("contact verification is covered by the submission error handler and cleanup", async () => {
  const contact = await readFile(new URL("../app/contact/page.js", import.meta.url), "utf8");
  assert.match(contact, /try\s*\{\s*const token = await executeRecaptcha/);
  assert.match(contact, /finally\s*\{\s*setIsSubmitting\(false\)/);
  assert.match(contact, /error_reason: reason,\s*lead_id: leadId/);
});
