import { BASE_URL } from "@/app/data/seoProducts";
import { CORE_SITEMAP_ENTRIES } from "@/app/data/seoRoutes.mjs";

export default function sitemap() {
  return CORE_SITEMAP_ENTRIES.map(({ path, ...entry }) => ({
    url: path === "/" ? BASE_URL : `${BASE_URL}${path}`,
    ...entry,
  }));
}
