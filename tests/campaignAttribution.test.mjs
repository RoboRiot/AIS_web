import test from "node:test";
import assert from "node:assert/strict";
import { resolveAttribution, createAttributionReader } from "../app/data/browserAttribution.mjs";
import { normalizeEventAttribution } from "../app/data/campaignAttribution.mjs";
import { normalizeLeadAnalytics } from "../app/data/leadAnalytics.mjs";
import { analyticsPageUrl } from "../app/data/analyticsPrivacy.mjs";
import { buildChannelReport } from "../app/data/channelReport.mjs";

const origin = "https://advancedimagingparts.com";
test("explicit campaign media override referrer and distinguish non-search channels", () => {
  for (const [source, medium, expected] of [["linkedin", "social", "organic_social"],
    ["linkedin", "paid_social", "paid_social"], ["dotmed", "display", "display"],
    ["dotmed", "email", "email"], ["ahra", "referral", "referral"],
    ["dotmed", "offline", "offline"], ["linkedin", "outreach", "outreach"],
    ["google", "cpc", "paid_search"], ["test", "custom", "other_campaign"]]) {
    const actual = resolveAttribution({ href: `${origin}/trailers?utm_source=${source}&utm_medium=${medium}`, referrer: "https://google.com/" });
    assert.equal(actual.acquisition_source, expected);
    assert.equal(normalizeLeadAnalytics(actual).acquisitionSource, expected);
  }
  assert.equal(resolveAttribution({ href: origin, referrer: "https://www.linkedin.com/feed" }).acquisition_source, "organic_social");
});

test("placement, term and campaign ID survive contact navigation and accepted-lead normalization", () => {
  const read = createAttributionReader();
  read({ href: `${origin}/trailers?utm_source=dotmed&utm_medium=display&utm_campaign=mobiles&utm_content=banner_ct&utm_term=ct&utm_id=q3`, now: 1000 });
  const contact = read({ href: `${origin}/contact`, now: 2000 });
  assert.equal(contact.utm_content, "banner_ct");
  assert.equal(contact.landing_path, "/trailers");
  assert.deepEqual(normalizeLeadAnalytics(contact).utm, { source: "dotmed", medium: "display", campaign: "mobiles", content: "banner_ct", term: "ct", id: "q3" });
  const changed = read({ href: `${origin}/trailers?utm_source=dotmed&utm_medium=display&utm_campaign=mobiles&utm_content=banner_mri&utm_term=ct&utm_id=q3`, now: 3000 });
  assert.equal(changed.utm_content, "banner_mri");
});

test("API attribution is independent of property limits and has no raw click IDs", () => {
  const properties = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`field_${i}`, i]));
  const result = normalizeEventAttribution({ properties, attribution: { utm_source: "ahra", utm_medium: "referral", utm_content: "basic_directory", landing_path: "/trailers?private=1", gclid: "private-click" } }, new URL(`${origin}/contact`));
  assert.equal(result.utm_source, "ahra");
  assert.equal(result.utm_content, "basic_directory");
  assert.equal(result.acquisition_source, "referral");
  assert.equal(result.landing_path, "/trailers");
  assert.equal(result.gclid, undefined);
  const legacy = normalizeEventAttribution({ properties: { utm_source: "linkedin", utm_medium: "social" } }, new URL(`${origin}/contact`));
  assert.equal(legacy.acquisition_source, "organic_social");
  assert.equal(normalizeEventAttribution({}, new URL(`${origin}/?utm_source=ahra&utm_medium=referral`)).utm_source, "ahra");
  assert.equal(normalizeEventAttribution({ attribution: { click_id_present: true } }, new URL(origin)).acquisition_source, "paid_search");
});

test("GA page URLs preserve placement without contact details or unrelated query fields", () => {
  const url = new URL(analyticsPageUrl(`${origin}/?email=private@example.com&utm_content=mri_post&utm_term=private@example.com`));
  assert.equal(url.searchParams.get("utm_content"), "mri_post");
  assert.equal(url.searchParams.get("utm_term"), "[redacted-email]");
  assert.equal(url.searchParams.has("email"), false);
});

test("channel reporting separates browsing and click intent from accepted and qualified inquiries", () => {
  const base = { utm: { source: "linkedin", medium: "social", campaign: "mobiles", content: "mri_post" }, acquisitionSource: "organic_social" };
  const lead = { ...base, id: "lead-12345678", eventType: "form_submit", formType: "trailer_request", properties: { lead_id: "12345678", confirmed_by: "lead_api" } };
  const events = [{ ...base, eventType: "page_view", visitorHash: "visitor" },
    { ...base, eventType: "page_view", visitorHash: "visitor" }, { ...base, eventType: "phone_click" },
    { ...lead, id: "client-event" }, lead, lead];
  let [row] = buildChannelReport(events);
  assert.equal(row.pageViews, 2);
  assert.equal(row.trackedVisitors, 1);
  assert.equal(row.phoneClicks, 1);
  assert.equal(row.acceptedInquiries, 1);
  assert.equal(row.qualifiedLeads, 0);
  assert.equal(row.unreviewedInquiries, 1);
  [row] = buildChannelReport(events, { "12345678": "qualified" });
  assert.equal(row.qualifiedLeads, 1);
  assert.equal(row.trailerInquiries, 1);
});

test("historical reports prefer saved external referrers and never attribute acquisition to AIS itself", () => {
  const events = [
    { eventType: "page_view", acquisitionSource: "organic_social", referrerHost: "advancedimagingparts.com", properties: { referrer_host: "www.linkedin.com" } },
    { eventType: "page_view", acquisitionSource: "paid_search", referrerHost: "www.advancedimagingparts.com" },
    { eventType: "page_view", acquisitionSource: "direct", referrerHost: "advancedimagingparts.com" },
  ];
  const rows = buildChannelReport(events);
  assert.equal(rows.find((row) => row.channel === "organic_social").source, "www.linkedin.com");
  assert.equal(rows.find((row) => row.channel === "paid_search").source, "unattributed");
  assert.equal(rows.find((row) => row.channel === "direct").source, "direct");
});
