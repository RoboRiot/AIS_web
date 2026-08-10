import { BASE_URL } from "@/app/data/seoProducts";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: [
      `${BASE_URL}/sitemap.xml`,
      `${BASE_URL}/sitemaps/services/sitemap.xml`,
      `${BASE_URL}/sitemaps/trailers/sitemap.xml`,
      `${BASE_URL}/sitemaps/products/sitemap.xml`,
    ],
  };
}
