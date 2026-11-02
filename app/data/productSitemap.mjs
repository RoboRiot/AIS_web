import { BASE_URL, buildProductSlug } from "./seoProducts.js";

// Keep each response well below the observed production truncation near 96 KB.
export const PRODUCT_SITEMAP_PAGE_SIZE = 100;
export const MAX_SITEMAP_BYTES = 48 * 1024;

export function buildProductSitemapEntries(products) {
  const seen = new Set();
  const entries = [];
  for (const product of products) {
    const slug = buildProductSlug(product);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const updatedAt = product.UpdatedAt ? new Date(product.UpdatedAt) : null;
    entries.push({
      url: `${BASE_URL}/products/${slug}`,
      ...(updatedAt && Number.isFinite(updatedAt.getTime())
        ? { lastModified: updatedAt.toISOString() } : {}),
    });
  }
  return entries.sort((a, b) => a.url < b.url ? -1 : a.url > b.url ? 1 : 0);
}

export function getProductSitemapIds(entries) {
  return Array.from({ length: Math.ceil(entries.length / PRODUCT_SITEMAP_PAGE_SIZE) },
    (_, id) => ({ id }));
}

export const productSitemapPath = (id) => `/sitemaps/products/sitemap/${id}.xml`;

export function getProductSitemapPage(entries, id) {
  if (!/^(0|[1-9]\d*)$/.test(String(id))) return null;
  const page = Number(id);
  if (!Number.isSafeInteger(page) || page >= getProductSitemapIds(entries).length) return null;
  return entries.slice(page * PRODUCT_SITEMAP_PAGE_SIZE, (page + 1) * PRODUCT_SITEMAP_PAGE_SIZE)
    .map((entry) => ({ ...entry, changeFrequency: "monthly", priority: 0.7 }));
}
