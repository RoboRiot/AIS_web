import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { BASE_URL } from "../app/data/seoProducts.js";
import { STATIC_SITEMAP_PATHS } from "../app/data/seoRoutes.mjs";
import { MAX_SITEMAP_BYTES, PRODUCT_SITEMAP_PAGE_SIZE } from "../app/data/productSitemap.mjs";

const parser = new XMLParser({ parseTagValue: false });
const array = (value) => value == null ? [] : Array.isArray(value) ? value : [value];

export function parseSitemap(xml, label) {
  assert.ok(!/<!DOCTYPE|<!ENTITY/i.test(xml), `${label}: unexpected XML declaration`);
  const valid = XMLValidator.validate(xml);
  assert.equal(valid, true, `${label}: invalid or incomplete XML`);
  const document = parser.parse(xml);
  const isIndex = Object.hasOwn(document, "sitemapindex");
  assert.notEqual(isIndex, Object.hasOwn(document, "urlset"), `${label}: missing/ambiguous sitemap root`);
  const entries = array(isIndex ? document.sitemapindex.sitemap : document.urlset.url);
  const locations = entries.map((entry) => {
    assert.equal(typeof entry.loc, "string", `${label}: missing location`);
    const url = new URL(entry.loc);
    assert.equal(url.origin, BASE_URL, `${label}: noncanonical host`);
    assert.ok(!url.search && !url.hash, `${label}: noncanonical query/fragment`);
    return url.href;
  });
  assert.equal(new Set(locations).size, locations.length, `${label}: duplicate locations`);
  return { isIndex, locations, bytes: Buffer.byteLength(xml) };
}

// Serial reads keep public checks gentle. An incomplete leaf fails the whole audit.
export async function readSitemapTree(read) {
  const root = parseSitemap(await read("/sitemap.xml"), "/sitemap.xml");
  assert.ok(root.isIndex && root.locations.length, "Expected a nonempty root sitemap index");
  const documents = [{ path: "/sitemap.xml", ...root }];
  const urls = new Set();
  for (const location of root.locations) {
    const pathname = new URL(location).pathname;
    assert.match(pathname, /^\/sitemaps\/[a-z0-9/.-]+\.xml$/, "Unexpected sitemap path");
    assert.ok(!pathname.includes(".."), "Unsafe sitemap path");
    const leaf = parseSitemap(await read(pathname), pathname);
    assert.ok(!leaf.isIndex, `${pathname}: nested sitemap index`);
    assert.ok(leaf.locations.length, `${pathname}: empty sitemap`);
    for (const url of leaf.locations) {
      assert.ok(!urls.has(url), `${pathname}: duplicate URL across sitemaps`);
      urls.add(url);
    }
    documents.push({ path: pathname, ...leaf });
  }
  return { documents, urls: [...urls] };
}

export async function verifySitemaps(read) {
  const result = await readSitemapTree(read);
  const paths = new Set(result.documents.map((document) => document.path));
  for (const pathname of STATIC_SITEMAP_PATHS) assert.ok(paths.has(pathname), `Missing ${pathname}`);
  let products = 0;
  let productSitemaps = 0;
  for (const document of result.documents) {
    assert.ok(document.bytes <= MAX_SITEMAP_BYTES, `${document.path}: exceeds ${MAX_SITEMAP_BYTES} bytes`);
    if (!/^\/sitemaps\/products\/sitemap\/(0|[1-9]\d*)\.xml$/.test(document.path)) {
      assert.ok(document.isIndex || STATIC_SITEMAP_PATHS.includes(document.path), `Unexpected leaf ${document.path}`);
      continue;
    }
    assert.equal(document.path, `/sitemaps/products/sitemap/${productSitemaps}.xml`, "Missing or unordered product shard");
    assert.ok(document.locations.length <= PRODUCT_SITEMAP_PAGE_SIZE, "Oversized product shard");
    for (const url of document.locations) assert.match(new URL(url).pathname, /^\/products\/.+--id-[0-9a-f]+$/);
    products += document.locations.length;
    productSitemaps += 1;
  }
  assert.ok(products > 0, "Missing product sitemaps");
  return { ...result, products, productSitemaps, largestBytes: Math.max(...result.documents.map((document) => document.bytes)) };
}

export const verifyBuiltSitemaps = ({ distDir, projectRoot = process.cwd() }) =>
  verifySitemaps((pathname) => readFile(path.join(projectRoot, distDir, "server/app", `${pathname.slice(1)}.body`), "utf8"));

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const base = new URL(process.argv[2] || "http://127.0.0.1:3096");
  assert.ok(["127.0.0.1", "localhost", "advancedimagingparts.com"].includes(base.hostname));
  const result = await verifySitemaps(async (pathname) => {
    const response = await fetch(new URL(pathname, base), {
      redirect: "manual", signal: AbortSignal.timeout(45000),
      headers: { "User-Agent": "AIS-Website-Health-Monitor/1.0" },
    });
    assert.equal(response.status, 200, pathname);
    assert.match(response.headers.get("content-type"), /xml/);
    return response.text();
  });
  console.log(JSON.stringify({ base: base.origin, checkedAt: new Date().toISOString(),
    sitemaps: result.documents.length, products: result.products, productSitemaps: result.productSitemaps,
    urls: result.urls.length, largestBytes: result.largestBytes }, null, 2));
}
