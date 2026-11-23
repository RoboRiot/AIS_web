import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { AvailabilityStop, createAuditRequester, isTransient, oldestFirst, publicInternalUrl, recordCheck } from "./lib/link-audit-policy.mjs";
import { openMonitoringSession } from "./lib/public-monitoring-session.mjs";

const require = createRequire(import.meta.url);
const { XMLParser, XMLValidator } = require("fast-xml-parser");
const { parse } = require("next/dist/compiled/node-html-parser");
const array = (value) => !value ? [] : Array.isArray(value) ? value : [value];
const product = (url) => new URL(url).pathname.startsWith("/products/");

export async function auditPublicLinks({ base = "https://advancedimagingparts.com", batchSize = 500, previous = {}, fetchImpl, sleep } = {}) {
  base = new URL(base).origin;
  const checkedAt = new Date().toISOString();
  const queue = new Set(Object.keys(previous).filter((url) => publicInternalUrl(url, base, base) === url));
  const state = { ...previous };
  const requester = createAuditRequester({ fetchImpl, sleep });
  const sitemapResults = [], issues = [], external = [];
  const routes = new Set(), results = new Map(), links = new Map(), contacts = new Map();
  const visitedSitemaps = new Set();
  let sitemapComplete = false, interrupted = false, robots = null;
  async function sitemap(url) {
    if (visitedSitemaps.has(url)) throw new Error(`Sitemap cycle or duplicate: ${url}`);
    if (visitedSitemaps.size >= 200) throw new Error("Sitemap discovery limit reached");
    if (publicInternalUrl(url, base, base) !== url) throw new Error(`Non-local sitemap: ${url}`);
    visitedSitemaps.add(url);
    const result = await requester.request(url);
    sitemapResults.push({ url, status: result.status, cachedAt: result.cachedAt || null });
    if (result.status !== 200) throw new Error(`Sitemap failed: ${url} (${result.status})`);
    if (XMLValidator.validate(result.text) !== true) throw new Error(`Invalid sitemap XML: ${url}`);
    const xml = new XMLParser().parse(result.text);
    if (xml.sitemapindex) {
      for (const entry of array(xml.sitemapindex.sitemap)) await sitemap(entry.loc);
    } else if (xml.urlset) {
      for (const entry of array(xml.urlset.url)) {
        const target = publicInternalUrl(entry.loc, url, base);
        if (!target) throw new Error(`Non-public sitemap entry in ${url}`);
        routes.add(target); queue.add(target);
      }
    } else throw new Error(`Missing sitemap root: ${url}`);
  }
  async function inspect(url) {
    if (results.has(url)) return;
    const { text, ...result } = await requester.request(url);
    result.url = url;
    results.set(url, result);
    state[url] = recordCheck(state[url], result, checkedAt);
    if (result.status !== 200) {
      if (!isTransient(result.status)) issues.push({ type: "http", url, status: result.status });
      return;
    }
    if (!result.contentType.includes("text/html")) return;
    const document = parse(text);
    result.title = document.querySelector("title")?.textContent || "";
    result.canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href") || "";
    result.robots = document.querySelector('meta[name="robots"]')?.getAttribute("content") || "";
    result.h1Count = document.querySelectorAll("h1").length;
    if (routes.has(url)) {
      if (!result.canonical || /noindex/i.test(`${result.robots} ${result.robotsHeader || ""}`)) issues.push({ type: "indexability", url });
      if (result.canonical) {
        try {
          const canonical = new URL(result.canonical, base);
          if (canonical.origin !== base || canonical.pathname !== new URL(result.finalUrl).pathname) issues.push({ type: "canonical-mismatch", url, canonical: result.canonical });
        } catch { issues.push({ type: "invalid-canonical", url }); }
      }
    }
    for (const anchor of document.querySelectorAll("a[href]")) {
      const href = anchor.getAttribute("href");
      if (/^(tel|mailto):/i.test(href)) {
        if (!contacts.has(href)) contacts.set(href, new Set());
        contacts.get(href).add(url); continue;
      }
      let target;
      try { target = new URL(href, result.finalUrl); } catch { continue; }
      if (!/^https?:$/.test(target.protocol)) continue;
      target.hash = "";
      const internal = publicInternalUrl(target.href, result.finalUrl, base);
      // Operational endpoints are neither crawled nor treated as external CTAs.
      if (!internal && [new URL(base).hostname, `www.${new URL(base).hostname}`].includes(target.hostname)) continue;
      const key = internal || target.href;
      links.set(key, { internal: !!internal, from: url });
      if (internal) { queue.add(key); state[key] ||= { discoveredAt: checkedAt }; }
    }
  }
  try {
    await sitemap(`${base}/sitemap.xml`);
    sitemapComplete = true;
    for (const url of routes) state[url] ||= { discoveredAt: checkedAt };
    // Core landing pages are checked daily; other navigation uses the same
    // persistent queue as products, including links absent from the sitemap.
    const core = [...routes].filter((url) => !product(url));
    for (const url of core) await inspect(url);
    const other = oldestFirst([...queue].filter((url) => !product(url) && !results.has(url)), state).slice(0, 200);
    for (const url of other) await inspect(url);
    const selected = oldestFirst([...queue].filter(product), state).slice(0, Math.max(1, Math.min(500, batchSize)));
    for (const url of selected) await inspect(url);
    const result = await requester.request(`${base}/robots.txt`);
    robots = { status: result.status, text: result.text };
    if (result.status !== 200) issues.push({ type: "robots", status: result.status });
    for (const [url, detail] of links) {
      if (detail.internal) continue;
      const result = await requester.request(url, { internal: false });
      external.push({ url, status: result.status, finalUrl: result.finalUrl, error: result.error, from: detail.from });
    }
  } catch (error) {
    interrupted = true;
    issues.push({ type: error instanceof AvailabilityStop ? "audit-paused" : "discovery-error", message: error.message });
  }
  for (const url of queue) state[url] ||= { discoveredAt: checkedAt };
  if (requester.incidents.length) issues.push({ type: "availability-incident", affectedRequests: requester.incidents.length, samples: requester.incidents, recovered: requester.recovered });
  const cutoff = Date.now() - 32 * 86400000;
  const products = [...queue].filter(product);
  const verifiedRecently = products.filter((url) => {
    const item = state[url];
    const at = item.verifiedAt || (!isTransient(item.status || 0) ? item.checkedAt : null);
    return Date.parse(at) >= cutoff;
  }).length;
  const pages = [...results.values()];
  return { state, report: {
    checkedAt, base, complete: sitemapComplete && !interrupted && !requester.incidents.length,
    scope: "Bounded public GET audit, not a full catalog audit or form delivery test. External failures are inconclusive.",
    coverage: { sitemapDiscoveryComplete: sitemapComplete, sitemapsFetchedThisRun: sitemapResults.filter((r) => !r.cachedAt).length,
      sitemapsReusedFromCache: sitemapResults.filter((r) => r.cachedAt).length,
      sitemapRoutes: routes.size, coreRoutes: [...routes].filter((url) => !product(url)).length,
      productRoutes: [...routes].filter(product).length, productQueue: products.length,
      productsThisRun: pages.filter((p) => product(p.url)).length,
      productsVerifiedThisRun: pages.filter((p) => product(p.url) && !isTransient(p.status)).length,
      productsCheckedWithin32Days: verifiedRecently, productsRemainingWithin32Days: products.length - verifiedRecently,
      pagesThisRun: pages.length, healthyPagesThisRun: pages.filter((p) => p.status === 200).length,
      internalLinksDiscovered: [...links.values()].filter((x) => x.internal).length,
      queuedLinksNotAttemptedThisRun: [...queue].filter((url) => !results.has(url)).length,
      productLinksDeferred: products.filter((url) => !results.has(url)).length, externalLinksChecked: external.length },
    sitemaps: sitemapResults, robots, issues, contacts: [...contacts].map(([target, sources]) => ({ target, pages: sources.size })), external, pages,
  } };
}

export async function main(args = process.argv.slice(2)) {
  const outputDir = path.resolve("outputs/marketing-health");
  await fs.mkdir(outputDir, { recursive: true });
  const statePath = path.join(outputDir, "link-audit-state.json");
  let previous = {};
  try { previous = JSON.parse(await fs.readFile(statePath, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const monitoring = await openMonitoringSession({ base: "https://advancedimagingparts.com" });
  let state, report;
  try {
    ({ state, report } = await auditPublicLinks({ previous, batchSize: Number(args[0]) || 500, fetchImpl: monitoring.fetch }));
    if (report.issues.some((issue) => issue.type === "availability-incident")) await monitoring.stop();
    report.monitoring = monitoring.state;
  } finally { await monitoring.close(); }
  const reportPath = path.join(outputDir, `link-audit-${report.checkedAt.replace(/[:.]/g, "-")}.json`);
  // Write evidence first and replace state atomically; an interrupted run must
  // never discard the previously discovered queue or advance unattempted URLs.
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  await fs.writeFile(`${statePath}.tmp`, JSON.stringify(state, null, 2));
  await fs.rename(`${statePath}.tmp`, statePath);
  console.log(JSON.stringify({ reportPath, complete: report.complete, coverage: report.coverage, issues: report.issues }, null, 2));
  process.exitCode = report.issues.length ? 1 : 0;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
