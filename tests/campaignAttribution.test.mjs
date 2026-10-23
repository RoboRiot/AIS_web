import test from "node:test";
import assert from "node:assert/strict";
import { resolveAttribution, createAttributionReader } from "../app/data/browserAttribution.mjs";
import { normalizeEventAttribution } from "../app/data/campaignAttribution.mjs";
import { normalizeLeadAnalytics } from "../app/data/leadAnalytics.mjs";
import { analyticsPageUrl } from "../app/data/analyticsPrivacy.mjs";
import { buildChannelReport } from "../app/data/channelReport.mjs";
import { ATTRIBUTION_HISTORY_KEY, readAttributionHistory } from "../app/data/attributionHistory.mjs";

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

test("known assistant referrers and their subdomains have a distinct AI channel", () => {
  for (const host of ["chatgpt.com", "chat.openai.com", "claude.ai", "grok.com", "perplexity.ai",
    "copilot.microsoft.com", "gemini.google.com", "www.perplexity.ai", "www.chatgpt.com", "CLAUDE.AI", "chatgpt.com."]) {
    const referrer = `https://${host}/conversation/private?prompt=private`;
    const browser = resolveAttribution({ href: `${origin}/trailers`, referrer });
    assert.equal(browser.acquisition_source, "ai_referral", host);
    assert.equal(normalizeEventAttribution({ referrer }, new URL(`${origin}/trailers`)).acquisition_source, "ai_referral", host);
    assert.equal(normalizeLeadAnalytics(browser).acquisitionSource, "ai_referral", host);
  }
});

test("AI attribution rejects lookalike domains and does not reclassify general search or social", () => {
  for (const host of ["chatgpt.com.example.org", "notchatgpt.com", "claude.ai.example.org", "fakeclaude.ai",
    "grok.com.example.org", "perplexity.ai.example.org", "copilot.microsoft.com.example.org", "gemini.google.com.example.org"]) {
    assert.notEqual(resolveAttribution({ href: origin, referrer: `https://${host}` }).acquisition_source, "ai_referral", host);
    assert.notEqual(resolveAttribution({ href: `${origin}/?utm_source=${host}` }).acquisition_source, "ai_referral", host);
  }
  for (const [host, expected] of [["www.google.com", "google_organic"], ["www.bing.com", "other_organic"],
    ["x.com", "organic_social"], ["openai.com", "referral"], ["microsoft.com", "referral"]]) {
    assert.equal(resolveAttribution({ href: origin, referrer: `https://${host}` }).acquisition_source, expected, host);
  }
  for (const source of ["google", "bing", "x", "ai", "unknown-ai-tool"]) {
    assert.notEqual(resolveAttribution({ href: `${origin}/?utm_source=${source}&utm_medium=ai` }).acquisition_source, "ai_referral", source);
  }
  assert.equal(resolveAttribution({ href: origin }).acquisition_source, "direct");
});

test("explicit known assistant tags work without referrers and require an organic AI medium", () => {
  for (const source of ["chatgpt.com", "chat.openai.com", "chatgpt", "claude", "claude.ai", "grok", "grok.com",
    "perplexity", "perplexity.ai", "copilot", "copilot.microsoft.com", "microsoft_copilot", "microsoft-copilot",
    "gemini", "gemini.google.com", "google_gemini", "google-gemini"]) {
    for (const medium of ["", "referral", "organic", "ai", "llm", "ai_search", "ai-search", "ai_referral", "ai-referral", "organic_ai", "organic-ai"]) {
      const href = `${origin}/services?utm_source=${source}&utm_medium=${medium}`;
      assert.equal(resolveAttribution({ href }).acquisition_source, "ai_referral", `${source}/${medium}`);
      assert.equal(normalizeEventAttribution({}, new URL(href)).acquisition_source, "ai_referral", `${source}/${medium}`);
    }
  }
  assert.equal(resolveAttribution({ href: `${origin}/?utm_source=ChatGPT.com&utm_medium=Referral` }).acquisition_source, "ai_referral");
  assert.equal(resolveAttribution({ href: `${origin}/?utm_source=chatgpt&utm_medium=custom`, referrer: "https://chatgpt.com" }).acquisition_source, "other_campaign");
  assert.equal(resolveAttribution({ href: `${origin}/?utm_source=ahra&utm_medium=referral`, referrer: "https://chatgpt.com" }).acquisition_source, "referral");
});

test("paid and explicit non-AI channels take priority over assistant tags and referrers", () => {
  for (const [medium, expected] of [["cpc", "paid_search"], ["paid_search", "paid_search"], ["paid_social", "paid_social"],
    ["display", "display"], ["email", "email"], ["outreach", "outreach"], ["social", "organic_social"], ["offline", "offline"]]) {
    for (const click of ["", "&gclid=test-click-123"]) {
      const href = `${origin}/?utm_source=chatgpt.com&utm_medium=${medium}${click}`;
      assert.equal(resolveAttribution({ href, referrer: "https://chatgpt.com" }).acquisition_source, expected, `${medium}/${click}`);
    }
  }
  for (const click of ["gclid", "gbraid", "wbraid", "msclkid"]) {
    for (const tags of ["", "&utm_source=chatgpt.com", "&utm_source=chatgpt.com&utm_medium=referral"]) {
      assert.equal(resolveAttribution({ href: `${origin}/?${click}=test-click-123${tags}`, referrer: "https://chatgpt.com" }).acquisition_source, "paid_search", `${click}/${tags}`);
    }
  }
  assert.equal(normalizeEventAttribution({ attribution: { utm_source: "chatgpt.com", utm_medium: "referral", click_id_present: true } }, new URL(origin)).acquisition_source, "paid_search");
});

test("AI attribution follows contact navigation and flows into server events and channel reports", () => {
  const read = createAttributionReader();
  read({ href: `${origin}/trailers?utm_source=chatgpt.com`, referrer: "https://chatgpt.com/c/private", now: 1000 });
  const contact = read({ href: `${origin}/contact`, now: 2000 });
  const event = normalizeEventAttribution({ attribution: contact }, new URL(`${origin}/contact`));
  const lead = normalizeLeadAnalytics(contact);
  assert.equal(event.acquisition_source, "ai_referral");
  assert.equal(event.landing_path, "/trailers");
  assert.equal(event.referrer_host, "chatgpt.com");
  assert.equal(lead.acquisitionSource, "ai_referral");
  const [row] = buildChannelReport([
    { eventType: "page_view", acquisitionSource: event.acquisition_source, visitorHash: "visitor", referrerHost: event.referrer_host },
    { eventType: "form_submit", id: "lead-12345678", acquisitionSource: lead.acquisitionSource, referrerHost: lead.referrerHost,
      formType: "trailer_request", properties: { lead_id: "12345678", confirmed_by: "lead_api" } },
  ]);
  assert.equal(row.channel, "ai_referral");
  assert.equal(row.source, "chatgpt.com");
  assert.equal(row.pageViews, 1);
  assert.equal(row.acceptedInquiries, 1);
  assert.equal(row.qualifiedLeads, 0);
});

test("AI attribution retains privacy redaction and consent requirements for durable history", () => {
  const now = Date.now();
  const current = resolveAttribution({ href: `${origin}/trailers?utm_source=chatgpt.com&utm_term=private@example.com`, referrer: "https://chatgpt.com/c/private?prompt=private", now });
  const event = normalizeEventAttribution({ attribution: { ...current, gclid: "private-click" } }, new URL(`${origin}/contact`));
  assert.equal(event.utm_term, "[redacted-email]");
  assert.equal(event.referrer_host, "chatgpt.com");
  assert.equal(event.gclid, undefined);
  assert.equal(JSON.stringify(event).includes("prompt=private"), false);
  const data = new Map();
  const storage = { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
  assert.equal(readAttributionHistory({ current, storage, now }).firstTouch, null);
  assert.equal(data.has(ATTRIBUTION_HISTORY_KEY), false);
  const granted = readAttributionHistory({ current, storage, allowed: true, now });
  assert.equal(granted.firstTouch.acquisition_source, "ai_referral");
  assert.equal(granted.lastPaidTouch, null);
  assert.equal(normalizeLeadAnalytics({ ...current, attribution_history: granted }).attributionHistory.firstTouch.acquisition_source, "ai_referral");
  assert.equal(readAttributionHistory({ current, storage, allowed: false, now: now + 1000 }).firstTouch, null);
  assert.equal(data.has(ATTRIBUTION_HISTORY_KEY), false);
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
