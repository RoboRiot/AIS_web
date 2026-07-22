import { cache } from "react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import Subheader from "@/components/subheader/Subheader";
import FoundYourPart from "@/app/product-detail/found-your-part/FoundYourPart";
import {
  buildProductSlug,
  buildProductKeywords,
  buildProductSeoDescription,
  buildProductSeoTitle,
  cleanText,
  getProductUrl,
  getProductPartNumbers,
  parseProductSlug,
  parseProductSpecs,
} from "@/app/data/seoProducts";
import SeoProductClient from "./SeoProductClient";
import { fetchProductById, fetchProductBySlug } from "@/app/data/serverFirestoreProducts";

export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

const getProductBySlug = cache(async (slug) => {
  const { id, nameSlug } = parseProductSlug(slug);
  if (!nameSlug) return null;

  if (id) {
    const product = await fetchProductById(id);
    if (product) return product;
  }

  return fetchProductBySlug(nameSlug);
});

export async function generateMetadata({ params }) {
  const product = await getProductBySlug(params.slug);
  if (!product) {
    return {};
  }

  const canonicalSlug = buildProductSlug(product);
  const url = getProductUrl(canonicalSlug);
  const title = buildProductSeoTitle(product);
  const description = buildProductSeoDescription(product);
  const keywords = buildProductKeywords(product);
  const images = Array.isArray(product.Images)
    ? product.Images.filter((image) => typeof image === "string" && image.startsWith("http"))
    : [];

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      ...(images.length ? { images } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(images.length ? { images } : {}),
    },
  };
}

export default async function ProductSeoPage({ params }) {
  const product = await getProductBySlug(params.slug);
  if (!product) {
    notFound();
  }

  const canonicalSlug = buildProductSlug(product);
  if (canonicalSlug && canonicalSlug !== params.slug) {
    permanentRedirect(`/products/${canonicalSlug}`);
  }
  const url = getProductUrl(canonicalSlug);
  const specs = parseProductSpecs(product);
  const partNumbers = getProductPartNumbers(product);
  const title = buildProductSeoTitle(product);
  const description = buildProductSeoDescription(product);
  const manufacturer = cleanText(product.OEM || specs.manufacturer);
  const modality = cleanText(product.Modality || specs.category);
  const systemModel = cleanText(product.Machine || specs.systemModel);
  const primaryPartNumber = partNumbers[0] || cleanText(product.PN) || product.id;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: product.Name || "",
    description,
    category: modality || "Medical imaging part",
    model: systemModel || primaryPartNumber || "",
    sku: product.id || primaryPartNumber || "",
    mpn: primaryPartNumber || "",
    productID: primaryPartNumber || "",
    brand: manufacturer
      ? {
          "@type": "Brand",
          name: manufacturer,
        }
      : undefined,
    manufacturer: manufacturer
      ? {
          "@type": "Organization",
          name: manufacturer,
        }
      : undefined,
    image: Array.isArray(product.Images)
      ? product.Images.filter((image) => typeof image === "string" && image.startsWith("http"))
      : undefined,
    url,
    additionalProperty: [
      ...partNumbers.map((partNumber) => ({
        "@type": "PropertyValue",
        name: "Part Number",
        value: partNumber,
      })),
      systemModel
        ? {
            "@type": "PropertyValue",
            name: "System Model",
            value: systemModel,
          }
        : null,
      modality
        ? {
            "@type": "PropertyValue",
            name: "Modality",
            value: modality,
          }
        : null,
    ].filter(Boolean),
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://advancedimagingparts.com",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Parts",
        item: "https://advancedimagingparts.com/parts",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: product.Name || title,
        item: url,
      },
    ],
  };

  return (
    <>
      <Subheader title={product.Name || "Product Detail"} extraClass="product_bg" />
      <div className="container" data-product-id={product.id}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
        <div className="seo-fallback">
          <div className="grid-container-2" style={{ margin: "40px 0" }}>
            <div>
              <h2>{title}</h2>
              <p>
                {description}
              </p>
              <ul className="list-none">
                <li>
                  <b>AIS Item ID:</b> {product.id || "N/A"}
                </li>
                <li>
                  <b>Product Name:</b> {product.Name || "N/A"}
                </li>
                <li>
                  <b>Part Number:</b> {partNumbers.length ? partNumbers.join(", ") : "N/A"}
                </li>
                <li>
                  <b>System Model:</b> {systemModel || "N/A"}
                </li>
                <li>
                  <b>Manufacturer:</b> {manufacturer || "N/A"}
                </li>
                <li>
                  <b>Category:</b> {modality || "N/A"}
                </li>
                <li>
                  <b>Availability:</b> {product.Available === false ? "Call for availability" : "Available"}
                </li>
                {product.Condition && (
                  <li>
                    <b>Condition:</b> {product.Condition}
                  </li>
                )}
              </ul>
              <p>
                Call for pricing: <Link href="tel:+18002003583">(800) 200-3583</Link> or{" "}
                <Link href="/contact">request availability and compatibility support</Link>.
              </p>
            </div>
            <div>
              <h2>Compatibility and Availability</h2>
              <p>
                Searching by product name, model, or part number? This page is optimized to match
                exact and partial queries such as {product.Name}, {partNumbers.slice(0, 3).join(", ") || "the listed part number"},
                and compatible {manufacturer || "OEM"} {modality || "imaging"} system terms.
              </p>
              <p>
                Advanced Imaging Parts can help confirm fit, availability, lead time, and related
                CT or MRI replacement parts before you place a request.
              </p>
              <p>
                Browse more <Link href="/parts">medical imaging parts</Link> or learn about{" "}
                <Link href="/services">MRI, CT, and PET/CT service support</Link>.
              </p>
            </div>
          </div>
        </div>
      </div>
      <SeoProductClient initialProduct={product} />
      <FoundYourPart />
    </>
  );
}
