import test from "node:test";
import assert from "node:assert/strict";
import { buildProductSitemapEntries, getProductSitemapIds, getProductSitemapPage, productSitemapPath, MAX_SITEMAP_BYTES } from "../app/data/productSitemap.mjs";
import { BASE_URL } from "../app/data/seoProducts.js";
import { STATIC_SITEMAP_PATHS } from "../app/data/seoRoutes.mjs";
import { parseSitemap, readSitemapTree, verifySitemaps } from "../scripts/verify-sitemaps.mjs";

test("product entries deduplicate, sort and preserve only valid modification dates", () => {
  const a = { id: "a", Name: "Alpha", PN: "123", UpdatedAt: "2026-11-01" };
  const b = { id: "b", Name: "Beta", PN: "456", UpdatedAt: "invalid" };
  const entries = buildProductSitemapEntries([b, a, a, null]);
  assert.equal(entries.length, 2);
  assert.match(entries[0].url, /alpha/);
  assert.equal(entries[0].lastModified, "2026-11-01T00:00:00.000Z");
  assert.ok(!Object.hasOwn(entries[1], "lastModified"));
  assert.deepEqual(entries, buildProductSitemapEntries([a, b]));
});

test("sitemap pagination includes every URL at exact and partial boundaries", () => {
  for (const count of [0, 1, 99, 100, 101, 200, 7982]) {
    const entries = Array.from({ length: count }, (_, id) => ({ url: `${BASE_URL}/products/item--id-${id.toString(16)}` }));
    const ids = getProductSitemapIds(entries);
    assert.equal(ids.length, Math.ceil(count / 100));
    const pages = ids.map(({ id }) => getProductSitemapPage(entries, String(id)));
    assert.deepEqual(pages.flat().map(({ url }) => url), entries.map(({ url }) => url));
    for (const page of pages) assert.ok(page.length > 0 && page.length <= 100);
    for (const id of [-1, 0.5, "01", "1x", "", undefined, ids.length, Number.MAX_SAFE_INTEGER + 1]) {
      assert.equal(getProductSitemapPage(entries, id), null);
    }
  }
  assert.equal(productSitemapPath(3), "/sitemaps/products/sitemap/3.xml");
});

const urlset = (urls) => `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<url><loc>${url}</loc></url>`).join("")}</urlset>`;
const index = (paths) => `<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<sitemap><loc>${BASE_URL}${path}</loc></sitemap>`).join("")}</sitemapindex>`;
const fixture = () => new Map([
  ["/sitemap.xml", index([...STATIC_SITEMAP_PATHS, productSitemapPath(0)])],
  ...STATIC_SITEMAP_PATHS.map((path, id) => [path, urlset([`${BASE_URL}/page-${id}`])]),
  [productSitemapPath(0), urlset([`${BASE_URL}/products/part--id-61`])],
]);
const read = (files) => async (path) => {
  assert.ok(files.has(path), `Missing file ${path}`);
  return files.get(path);
};

test("full sitemap verification reads every indexed leaf", async () => {
  const result = await verifySitemaps(read(fixture()));
  assert.equal(result.products, 1);
  assert.equal(result.productSitemaps, 1);
  assert.equal(result.documents.length, 5);
  assert.equal(result.urls.length, 4);
});

test("XML validation rejects truncated, wrong-host and duplicate locations", () => {
  const valid = urlset([`${BASE_URL}/services`]);
  for (const xml of [valid.slice(0, -5), "<html>error</html>", valid.replace(BASE_URL, "https://example.com"),
    urlset([`${BASE_URL}/services`, `${BASE_URL}/services`]), '<!DOCTYPE foo><urlset/>']) {
    assert.throws(() => parseSitemap(xml, "fixture"));
  }
});

test("missing, nested, duplicate, oversized and empty sitemaps fail closed", async () => {
  const mutations = [
    (files) => files.delete(productSitemapPath(0)),
    (files) => files.set(productSitemapPath(0), index(STATIC_SITEMAP_PATHS)),
    (files) => files.set(productSitemapPath(0), urlset([`${BASE_URL}/page-0`])),
    (files) => files.set(productSitemapPath(0), urlset([])),
    (files) => files.set(productSitemapPath(0), `${files.get(productSitemapPath(0))}\n${" ".repeat(MAX_SITEMAP_BYTES)}`),
    (files) => files.set(productSitemapPath(0), urlset(Array.from({ length: 101 }, (_, i) => `${BASE_URL}/products/part--id-${i.toString(16)}`))),
    (files) => files.set("/sitemap.xml", index(STATIC_SITEMAP_PATHS)),
  ];
  for (const mutate of mutations) {
    const files = fixture();
    mutate(files);
    await assert.rejects(verifySitemaps(read(files)));
  }
});

test("audit discovery still reads the pre-migration monolithic product sitemap", async () => {
  const files = fixture();
  files.set("/sitemap.xml", index([...STATIC_SITEMAP_PATHS, "/sitemaps/products/sitemap.xml"]));
  files.set("/sitemaps/products/sitemap.xml", files.get(productSitemapPath(0)));
  assert.equal((await readSitemapTree(read(files))).urls.length, 4);
});
