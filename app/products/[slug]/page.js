import { cache } from "react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import Subheader from "@/components/subheader/Subheader";
import FoundYourPart from "@/app/product-detail/found-your-part/FoundYourPart";
import {
  buildPartsCategoryHref,
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
import { isCampaignReadyProduct } from "@/app/data/catalogProductQuality.mjs";
import { DEFAULT_SOCIAL_IMAGES } from "@/app/data/siteMetadata";

export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

const getProductBySlug = cache(async (slug) => {
  const { id, nameSlug } = parseProductSlug(slug);
  if (!nameSlug) return null;

  if (id) {
    const product = await fetchProductById(id);
    if (product && isCampaignReadyProduct(product)) return product;
  }

  const product = await fetchProductBySlug(nameSlug);
  return product && isCampaignReadyProduct(product) ? product : null;
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
  const socialImages = images.length ? images : DEFAULT_SOCIAL_IMAGES;

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
      images: socialImages,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: socialImages,
    },
  };
}

export default async function ProductSeoPage({ params }) {
  const product = await getProductBySlug(params.slug);
  if (!product) {
    notFound();
  }

  const canonicalSlug = buildProductSlug(product);
  if (params.slug !== canonicalSlug) {
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
  const productName = cleanText(product.Name) || "Medical Imaging Part";
  const displayHeading = [
    productName,
    primaryPartNumber && !productName.toLowerCase().includes(String(primaryPartNumber).toLowerCase())
      ? primaryPartNumber
      : "",
  ].filter(Boolean).join(" ");
  const categoryHref = manufacturer && modality
    ? buildPartsCategoryHref(manufacturer, modality)
    : "/parts";
  const normalizedCondition = cleanText(product.Condition).toLowerCase();
  const itemCondition = normalizedCondition.includes("new")
    ? "https://schema.org/NewCondition"
    : normalizedCondition.includes("used") || normalizedCondition.includes("refurb")
      ? "https://schema.org/UsedCondition"
      : undefined;
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
    itemCondition,
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
      <Subheader title={displayHeading} extraClass="product_bg" />
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
              <h2>{displayHeading}</h2>
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
                  <b>Availability:</b> Request current availability
                </li>
                {product.Condition && (
                  <li>
                    <b>Condition:</b> {product.Condition}
                  </li>
                )}
              </ul>
              <p>
                Call for pricing: <Link href="tel:+15595376851">(559) 537-6851</Link> or{" "}
                <Link href="/contact">request availability and compatibility support</Link>.
              </p>
            </div>
            <div>
              <h2>Compatibility and Availability</h2>
              <p>
                Compatibility can vary by scanner configuration, software level, and revision.
                Send the exact part number and installed system model so our team can confirm fit
                before a quote is prepared.
              </p>
              <p>
                Advanced Imaging Parts can help confirm condition, current availability, lead time,
                and related replacement options for {manufacturer || "medical imaging"} {modality || "equipment"} systems.
              </p>
              <p>
                Browse more <Link href={categoryHref}>{[manufacturer, modality].filter(Boolean).join(" ") || "medical imaging"} parts</Link> or learn about{" "}
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
