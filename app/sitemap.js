import { BASE_URL, buildProductSlug } from "@/app/data/seoProducts";
import { fetchAllProducts } from "@/app/data/firestoreProducts";

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
      url: `${BASE_URL}/services/ge-mobile-mri`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/services/philips-mobile-mri`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/services/siemens-mobile-mri`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/services/mobile-mri-trailer-rental`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${BASE_URL}/services/mobile-ct-trailer-rental`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/services/mobile-pet-ct-trailer`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

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
