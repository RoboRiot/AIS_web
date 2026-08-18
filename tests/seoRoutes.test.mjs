import assert from "node:assert/strict";
import test from "node:test";
import {
  CORE_SITEMAP_ENTRIES,
  PART_CATEGORY_PATHS,
  SITEMAP_PATHS,
} from "../app/data/seoRoutes.mjs";

test("publishes unique canonical core URLs", () => {
  const paths = CORE_SITEMAP_ENTRIES.map((entry) => entry.path);
  assert.equal(new Set(paths).size, paths.length);
  assert.ok(paths.every((path) => path.startsWith("/")));
  assert.equal(paths.includes("/service-request"), false);
  assert.equal(paths.includes("/parts-old"), false);
});

test("includes every parts category in the core sitemap", () => {
  const paths = new Set(CORE_SITEMAP_ENTRIES.map((entry) => entry.path));
  assert.ok(PART_CATEGORY_PATHS.every((path) => paths.has(path)));
});

test("uses one canonical sitemap index with unique child maps", () => {
  assert.equal(new Set(SITEMAP_PATHS).size, SITEMAP_PATHS.length);
  assert.deepEqual(SITEMAP_PATHS, [
    "/sitemaps/core/sitemap.xml",
    "/sitemaps/services/sitemap.xml",
    "/sitemaps/trailers/sitemap.xml",
    "/sitemaps/products/sitemap.xml",
  ]);
});
