import { BASE_URL, buildProductSlug } from "@/app/data/seoProducts";
import { fetchAllProducts } from "@/app/data/firestoreProducts";
import { serviceLandingPages, trailerLandingPages } from "@/app/data/serviceLandingPages";

export default async function sitemap() {
  const now = new Date();
  const urls = [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/parts`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/services`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/trailers`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
  ];

  for (const page of serviceLandingPages) {
    urls.push({
      url: `${BASE_URL}/services/${page.slug}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: page.brand ? 0.78 : 0.82,
    });
  }

  for (const page of trailerLandingPages) {
    urls.push({
      url: `${BASE_URL}/trailers/${page.slug}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: page.brand ? 0.78 : 0.84,
    });
  }

  try {
    const products = await fetchAllProducts();
    const seen = new Set();
    for (const product of products) {
      const slug = buildProductSlug(product);
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      urls.push({
        url: `${BASE_URL}/products/${slug}`,
        lastModified: now,
        changeFrequency: "monthly",
        priority: 0.7,
      });
    }
  } catch {
    // fall back to base URLs only
  }

  return urls;
}
