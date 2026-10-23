import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { serviceLandingPages, trailerLandingPages } from "../app/data/serviceLandingPages.js";
import { PRODUCTION_SITE_URL } from "../site.config.mjs";

// Read-only HTTP preflight. This checks rendered HTML, not actual crawler visits,
// indexing, AI citations, browser behavior, or a host's WAF/IP configuration.
const base = new URL(process.argv[2] || "http://127.0.0.1:3022");
const normalize = (text) => text.replace(/\s+/g, " ").trim();
const decode = (text) => text
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&amp;/g, "&");
const paths = [
  ...serviceLandingPages.map((page) => `/services/${page.slug}`),
  ...trailerLandingPages.map((page) => `/trailers/${page.slug}`),
];
const rows = [];
for (const path of paths) {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(30_000) });
  assert.equal(response.status, 200, `${path}: HTTP status`);
  const html = await response.text();
  const canonical = `${PRODUCTION_SITE_URL}${path}`;
  assert.ok(html.includes(`rel="canonical" href="${canonical}"`), `${path}: canonical`);
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, `${path}: one H1`);
  assert.ok(!/<meta[^>]+(?:name="(?:robots|googlebot)"[^>]+content="[^"]*noindex|content="[^"]*noindex[^>]+name="(?:robots|googlebot)")/i.test(html), `${path}: indexable metadata`);
  assert.ok(!/noindex/i.test(response.headers.get("x-robots-tag") || ""), `${path}: indexable header`);
  const nodes = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .flatMap((match) => {
      const data = JSON.parse(match[1]);
      return data["@graph"] || [data];
    });
  const service = nodes.find((node) => node["@type"] === "Service" && node.url === canonical);
  assert.equal(service?.provider?.["@id"], `${PRODUCTION_SITE_URL}/#organization`, `${path}: provider identity`);
  const faqs = nodes.find((node) => node["@type"] === "FAQPage")?.mainEntity;
  assert.ok(faqs?.length >= 5, `${path}: structured questions`);
  const visible = normalize(decode(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]*>/g, " ")));
  for (const item of faqs) {
    assert.ok(visible.includes(normalize(item.name)), `${path}: visible question ${item.name}`);
    assert.ok(visible.includes(normalize(item.acceptedAnswer.text)), `${path}: visible answer ${item.name}`);
  }
  rows.push({ path, status: response.status, release: response.headers.get("x-ais-release"),
    canonical, faqCount: faqs.length, structuredAnswersInHtml: true,
    sha256: createHash("sha256").update(html).digest("hex") });
}
assert.equal(new Set(rows.map((row) => row.release)).size, 1, "All pages use the same release");
assert.ok(rows[0].release, "Release header is present");
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), base: base.origin,
  note: "HTTP and server HTML checks only; not proof of actual crawler access or AI rankings.",
  passed: rows.length, rows }, null, 2));
