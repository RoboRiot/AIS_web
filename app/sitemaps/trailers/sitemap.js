import { BASE_URL } from "@/app/data/seoProducts";
import { trailerLandingPages } from "@/app/data/serviceLandingPages";

export default function sitemap() {
  return trailerLandingPages.map((page) => ({
    url: `${BASE_URL}/trailers/${page.slug}`,
    changeFrequency: "monthly",
    priority: page.brand ? 0.78 : 0.86,
  }));
}
