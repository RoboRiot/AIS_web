import test from "node:test";
import assert from "node:assert/strict";
import { createOpenAiAttributionReader, OPENAI_ATTRIBUTION_KEY,
  OPENAI_ATTRIBUTION_MAX_AGE } from "../app/data/openAiAttribution.mjs";
import { readFileSync } from "node:fs";
import { analyticsPageUrl, analyticsReferrerUrl } from "../app/data/analyticsPrivacy.mjs";

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
}

test("OpenAI reference is never captured without advertising consent", () => {
  const read = createOpenAiAttributionReader(), storage = memoryStorage();
  assert.equal(read({href:"https://advancedimagingparts.com/?oppref=click_original",storage,now:1000}), "");
  assert.equal(storage.getItem(OPENAI_ATTRIBUTION_KEY), null);
  assert.equal(read({href:"https://advancedimagingparts.com/contact",storage,allowed:true,now:1001}), "");
});

test("consented ad click survives navigation and reload, retains original reference and age", () => {
  const read = createOpenAiAttributionReader(), storage = memoryStorage();
  const ref = "AbC_-~.123";
  const href = `https://advancedimagingparts.com/services/mri-service?oppref=${ref}`;
  assert.equal(read({href,storage,allowed:true,now:1000}), ref);
  assert.equal(read({href,storage,allowed:true,now:2000}), ref);
  assert.equal(JSON.parse(storage.getItem(OPENAI_ATTRIBUTION_KEY)).at, 1000);
  assert.equal(read({href:"https://advancedimagingparts.com/contact",storage,allowed:true,now:3000}), ref);
  assert.equal(createOpenAiAttributionReader()({href:"https://advancedimagingparts.com/contact",storage,allowed:true,now:4000}), ref);
});

test("withdrawal clears stored and memory attribution; expired or future references are rejected", () => {
  const read = createOpenAiAttributionReader(), storage = memoryStorage();
  read({href:"https://advancedimagingparts.com/?oppref=original",storage,allowed:true,now:1000});
  assert.equal(read({href:"https://advancedimagingparts.com/contact",storage,allowed:false,now:2000}), "");
  assert.equal(storage.getItem(OPENAI_ATTRIBUTION_KEY), null);
  assert.equal(read({href:"https://advancedimagingparts.com/contact",storage,allowed:true,now:3000}), "");
  for (const at of [3000-OPENAI_ATTRIBUTION_MAX_AGE, 4000]) {
    storage.setItem(OPENAI_ATTRIBUTION_KEY, JSON.stringify({oppref:"original",at}));
    assert.equal(createOpenAiAttributionReader()({href:"https://advancedimagingparts.com/contact",storage,allowed:true,now:3000}), "");
  }
});

test("a new genuine reference replaces the old one and invalid input never gets transformed", () => {
  const read = createOpenAiAttributionReader(), storage = memoryStorage();
  read({href:"https://advancedimagingparts.com/?oppref=old",storage,allowed:true,now:1000});
  assert.equal(read({href:"https://advancedimagingparts.com/?oppref=new",storage,allowed:true,now:2000}), "new");
  assert.equal(read({href:"https://advancedimagingparts.com/?oppref=%20invalid%20",storage,allowed:true,now:3000}), "new");
  assert.equal(JSON.parse(storage.getItem(OPENAI_ATTRIBUTION_KEY)).at, 2000);
});

test("an old landing tab cannot refresh an expired click by retaining it in the URL", () => {
  const read = createOpenAiAttributionReader(), storage = memoryStorage();
  const href = "https://advancedimagingparts.com/?oppref=original";
  read({href,storage,allowed:true,now:1000});
  assert.equal(read({href,storage,allowed:true,now:1000+OPENAI_ATTRIBUTION_MAX_AGE}), "");
  assert.equal(read({href,storage,allowed:true,now:2000+OPENAI_ATTRIBUTION_MAX_AGE}), "");
  read({href:"https://advancedimagingparts.com/contact",storage,allowed:true,now:3000+OPENAI_ATTRIBUTION_MAX_AGE});
  assert.equal(read({href,storage,allowed:true,now:4000+OPENAI_ATTRIBUTION_MAX_AGE}), "");
  storage.setItem(OPENAI_ATTRIBUTION_KEY, JSON.stringify({oppref:"original",at:1000}));
  assert.equal(createOpenAiAttributionReader()({href,storage,allowed:true,now:1000+OPENAI_ATTRIBUTION_MAX_AGE}), "");
});

test("OpenAI click references are excluded from Google page and referrer URLs", () => {
  const href = "https://advancedimagingparts.com/services/mri-service?oppref=private-click&utm_source=chatgpt#details";
  assert.equal(analyticsPageUrl(href), "https://advancedimagingparts.com/services/mri-service?utm_source=chatgpt");
  assert.equal(analyticsReferrerUrl(href), "https://advancedimagingparts.com/services/mri-service");
  assert.equal(analyticsReferrerUrl("javascript:alert(1)"), "");
});

test("restricted storage cannot break attribution or inquiry flow", () => {
  const storage = {getItem(){throw Error("blocked");},setItem(){throw Error("blocked");},removeItem(){throw Error("blocked");}};
  const read = createOpenAiAttributionReader();
  assert.equal(read({href:"https://advancedimagingparts.com/?oppref=original",storage,allowed:true,now:1000}), "original");
  assert.equal(read({href:"https://advancedimagingparts.com/contact",storage,allowed:true,now:2000}), "original");
  assert.equal(read({href:"https://advancedimagingparts.com/contact",storage,allowed:false,now:3000}), "");
});

test("the OpenAI reference is added only to accepted-inquiry context, not shared attribution", () => {
  const source = readFileSync(new URL("../components/utils/analytics.js",import.meta.url),"utf8");
  const leadContext = source.slice(source.indexOf("export const getLeadAnalyticsContext"), source.indexOf("const recordWebsiteEvent"));
  assert.match(leadContext, /oppref: openAiAttribution\(\)/);
  assert.doesNotMatch(source.slice(source.indexOf("const recordWebsiteEvent")), /oppref|openAiAttribution/);
});
