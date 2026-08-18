import { BASE_URL } from "@/app/data/seoProducts";
import { SITEMAP_PATHS } from "@/app/data/seoRoutes.mjs";

export const dynamic = "force-static";

export function GET() {
  const sitemapEntries = SITEMAP_PATHS.map(
    (path) => `  <sitemap><loc>${BASE_URL}${path}</loc></sitemap>`
  ).join("\n");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries}\n</sitemapindex>`,
    {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    }
  );
}
