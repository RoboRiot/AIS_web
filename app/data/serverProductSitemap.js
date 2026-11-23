import { fetchPublicProductPages } from "@/app/data/serverFirestoreProducts";
import { buildProductSitemapEntriesFromPages } from "@/app/data/productSitemap.mjs";
import { sharedProductSitemapEntries } from "@/app/data/productSitemapCache.mjs";

// Do not deserialize the full sitemap array or launch a catalog scan per shard.
// ISR still caches XML responses; the shared data refresh blocks and coalesces.
export const getProductSitemapEntries = () => sharedProductSitemapEntries(
  () => buildProductSitemapEntriesFromPages(fetchPublicProductPages())
);
