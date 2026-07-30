import { BASE_URL, buildProductSlug } from "@/app/data/seoProducts";
import { fetchAllProducts } from "@/app/data/serverFirestoreProducts";
import { serviceLandingPages, trailerLandingPages } from "@/app/data/serviceLandingPages";

const partsCategoryPaths = [
  "ge/mri",
  "ge/ct",
  "ge/pet-ct",
  "siemens/mri",
  "siemens/ct",
  "siemens/pet-ct",
  "toshiba/mri",
  "toshiba/ct",
  "philips/mri",
  "philips/ct",
  "philips/pet-ct",
];

export default async function sitemap() {
  const urls = [
    {
      url: BASE_URL,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/parts`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/services`,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/service-request`,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/about`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/contact`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/trailers`,
      changeFrequency: "weekly",
      priority: 0.85,
    },
  ];

  for (const path of partsCategoryPaths) {
    urls.push({
      url: `${BASE_URL}/parts/${path}`,
      changeFrequency: "weekly",
      priority: 0.76,
    });
  }

  for (const page of serviceLandingPages) {
    urls.push({
      url: `${BASE_URL}/services/${page.slug}`,
      changeFrequency: "monthly",
      priority: page.brand ? 0.78 : 0.82,
    });
  }

  for (const page of trailerLandingPages) {
    urls.push({
      url: `${BASE_URL}/trailers/${page.slug}`,
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
      const updatedAt = product.UpdatedAt
        ? new Date(product.UpdatedAt)
        : null;
      urls.push({
        url: `${BASE_URL}/products/${slug}`,
        ...(updatedAt && Number.isFinite(updatedAt.getTime())
          ? { lastModified: updatedAt }
          : {}),
        changeFrequency: "monthly",
        priority: 0.7,
      });
    }
  } catch {
    // fall back to base URLs only
  }

  return urls;
}
