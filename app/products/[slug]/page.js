import { cache } from "react";
import { notFound } from "next/navigation";
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
  slugify,
} from "@/app/data/seoProducts";
import SeoProductClient from "./SeoProductClient";
import { fetchAllProducts } from "@/app/data/firestoreProducts";

export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

const getProductBySlug = cache(async (nameSlug) => {
  if (!nameSlug) return null;
  const products = await fetchAllProducts();
  return products.find((product) => slugify(product?.Name) === nameSlug) || null;
});

export async function generateMetadata({ params }) {
  const { nameSlug } = parseProductSlug(params.slug);
  const product = await getProductBySlug(nameSlug);
  if (!product) {
    return {};
  }

  const canonicalSlug = buildProductSlug(product);
  const url = getProductUrl(canonicalSlug);
  const title = buildProductSeoTitle(product);
  const description = buildProductSeoDescription(product);
  const keywords = buildProductKeywords(product);

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
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function ProductSeoPage({ params }) {
  const { nameSlug } = parseProductSlug(params.slug);
  const product = await getProductBySlug(nameSlug);
  if (!product) {
    notFound();
  }

  const canonicalSlug = buildProductSlug(product);
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
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "USD",
      availability: product.Available === false
        ? "https://schema.org/OutOfStock"
        : "https://schema.org/InStock",
      seller: {
        "@type": "Organization",
        name: "Advanced Imaging Parts",
      },
    },
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
      <div className="container">
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
              </ul>
              <p>Call for pricing: (800) 200-3583</p>
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
            </div>
          </div>
        </div>
      </div>
      <SeoProductClient initialProduct={product} />
      <FoundYourPart />
    </>
  );
}
