import { notFound } from "next/navigation";
import { getProductSitemapEntries } from "@/app/data/serverProductSitemap";
import { getProductSitemapIds, getProductSitemapPage } from "@/app/data/productSitemap.mjs";

export const dynamic = "force-static";

export async function generateSitemaps() {
  return getProductSitemapIds(await getProductSitemapEntries());
}

export default async function sitemap({ id }) {
  const page = getProductSitemapPage(await getProductSitemapEntries(), id);
  if (!page) notFound();
  return page;
}
