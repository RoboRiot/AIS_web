import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getPrimaryImagePath, resolveImageUrl } from "@/app/data/catalogImageUrl.mjs";
import {
  BASE_URL,
  buildProductHref,
  buildProductImageAlt,
  getProductPartNumbers,
} from "@/app/data/seoProducts";
import { fetchCatalogProductsByCategory } from "@/app/data/serverFirestoreProducts";
import styles from "../../search.module.scss";

export const revalidate = 3600;

const oems = {
  ge: "GE",
  siemens: "Siemens",
  toshiba: "Toshiba",
  philips: "Philips",
};

const modalities = {
  mri: "MRI",
  ct: "CT",
  "pet-ct": "PET/CT",
};

const unavailableCombinations = new Set(["toshiba/pet-ct"]);

const categoryFor = (params) => {
  const oem = oems[params.oem];
  const modality = modalities[params.modality];
  if (!oem || !modality || unavailableCombinations.has(`${params.oem}/${params.modality}`)) {
    return null;
  }
  return { oem, modality };
};

export async function generateMetadata({ params }) {
  const category = categoryFor(params);
  if (!category) return {};
  const title = `${category.oem} ${category.modality} Parts | Advanced Imaging Services`;
  const description =
    `Browse reviewed ${category.oem} ${category.modality} replacement parts with product images, ` +
    "part numbers, compatibility details, and direct availability support.";
  const url = `${BASE_URL}/parts/${params.oem}/${params.modality}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website" },
  };
}

export default async function PartsCategoryPage({ params }) {
  const category = categoryFor(params);
  if (!category) notFound();

  let products = [];
  try {
    products = await fetchCatalogProductsByCategory({
      oem: category.oem,
      modality: category.modality,
      limit: 24,
    });
  } catch (error) {
    console.error("Unable to render parts category:", error);
  }

  const categoryUrl = `${BASE_URL}/parts/${params.oem}/${params.modality}`;
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${category.oem} ${category.modality} Parts`,
    url: categoryUrl,
    itemListElement: products.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: product.Name,
      url: `${BASE_URL}${buildProductHref(product)}`,
    })),
  };

  return (
    <>
      <main className={styles.category_page}>
        <div className="container">
          <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
            <Link href="/parts">Parts</Link>
            <span aria-hidden="true">/</span>
            <span>{category.oem} {category.modality}</span>
          </nav>
          <div className={styles.category_heading}>
            <div>
              <p className={styles.catalog_eyebrow}>REVIEWED MEDICAL IMAGING CATALOG</p>
              <h1>{category.oem} {category.modality} Replacement Parts</h1>
              <p>
                Browse product images and part numbers, then request current availability,
                compatibility confirmation, and lead-time support from Advanced Imaging Services.
              </p>
            </div>
            <Link
              className="simple-btn"
              href={`/parts?OEM=${encodeURIComponent(category.oem)}&modality=${encodeURIComponent(category.modality)}`}
            >
              Search All {category.oem} {category.modality} Parts
            </Link>
          </div>

          {products.length > 0 ? (
            <ul className={styles.category_products}>
              {await Promise.all(products.map(async (product) => {
                const partNumbers = getProductPartNumbers(product);
                const imageUrl = await resolveImageUrl(getPrimaryImagePath(product));
                return (
                  <li key={product.id}>
                    <Link href={buildProductHref(product)}>
                      <Image
                        src={imageUrl}
                        width={470}
                        height={320}
                        alt={buildProductImageAlt(product)}
                      />
                      <div>
                        <h2>{product.Name}</h2>
                        <p>{partNumbers[0] ? `Part number ${partNumbers[0]}` : "Request part details"}</p>
                        {product.Machine && <span>{product.Machine}</span>}
                      </div>
                    </Link>
                  </li>
                );
              }))}
            </ul>
          ) : (
            <div className={styles.category_empty}>
              <h2>Tell us which part you need</h2>
              <p>
                Our team can search beyond the currently featured catalog results and confirm
                compatible options for your system.
              </p>
              <Link className="simple-btn" href="/contact">Request Parts Support</Link>
            </div>
          )}
        </div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
        />
      </main>
    </>
  );
}
