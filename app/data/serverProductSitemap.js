import { unstable_cache } from "next/cache";
import { fetchAllProducts } from "@/app/data/serverFirestoreProducts";
import { buildProductSitemapEntries } from "@/app/data/productSitemap.mjs";

// Share compact entries across static sitemap generation, not full catalog records.
export const getProductSitemapEntries = unstable_cache(async () => {
  const entries = buildProductSitemapEntries(await fetchAllProducts());
  if (!entries.length) throw new Error("Product sitemap generation returned no public products.");
  return entries;
}, ["product-sitemap-entries-v1"], { revalidate: 3600 });
