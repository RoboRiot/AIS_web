import { BASE_URL, buildProductSlug } from "@/app/data/seoProducts";
import { fetchAllProducts } from "@/app/data/serverFirestoreProducts";

export default async function sitemap() {
  try {
    const products = await fetchAllProducts();
    const seen = new Set();
    const urls = [];

    for (const product of products) {
      const slug = buildProductSlug(product);
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      const updatedAt = product.UpdatedAt ? new Date(product.UpdatedAt) : null;
      urls.push({
        url: `${BASE_URL}/products/${slug}`,
        ...(updatedAt && Number.isFinite(updatedAt.getTime())
          ? { lastModified: updatedAt }
          : {}),
        changeFrequency: "monthly",
        priority: 0.7,
      });
    }

    return urls;
  } catch (error) {
    console.error("Unable to generate product sitemap:", error);
    return [];
  }
}
