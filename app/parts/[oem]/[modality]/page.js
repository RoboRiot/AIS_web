import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BASE_URL,
  buildProductHref,
} from "@/app/data/seoProducts";
import { fetchCatalogProductsByCategory } from "@/app/data/serverFirestoreProducts";
import PartsCatalogNav from "../../PartsCatalogNav";
import ProductsPage from "../../ProductsPage";
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
      limit: 12,
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
      <section className={styles.category_page}>
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
                Search {category.oem} {category.modality} parts by keyword, OEM part number,
                or compatible system model, then request current availability and
                compatibility confirmation.
              </p>
            </div>
          </div>
          <PartsCatalogNav
            activeOem={category.oem}
            activeModality={category.modality}
          />
        </div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
        />
      </section>
      <ProductsPage
        initialCatalog={{
          products,
          hasNextPage: false,
          nextCursor: null,
          totalMatches: null,
          sort: "a-z",
        }}
        initialFilters={{
          oem: category.oem,
          modality: category.modality,
        }}
        lockedFilters={{
          oem: true,
          modality: true,
        }}
        catalogPath={`/parts/${params.oem}/${params.modality}`}
        catalogLabel={`${category.oem} ${category.modality} parts`}
      />
    </>
  );
}
