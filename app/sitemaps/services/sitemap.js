import { BASE_URL } from "@/app/data/seoProducts";
import { serviceLandingPages } from "@/app/data/serviceLandingPages";

export default function sitemap() {
  return serviceLandingPages.map((page) => ({
    url: `${BASE_URL}/services/${page.slug}`,
    changeFrequency: "monthly",
    priority: page.brand ? 0.78 : 0.84,
  }));
}
