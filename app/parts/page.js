import Link from "next/link";
import { fetchInitialCatalogPage } from "@/app/data/serverFirestoreProducts";
import ProductsPage from "./ProductsPage";
import styles from "./search.module.scss";

export const revalidate = 3600;

const categories = [
  ["GE MRI Parts", "/parts/ge/mri"],
  ["GE CT Parts", "/parts/ge/ct"],
  ["GE PET/CT Parts", "/parts/ge/pet-ct"],
  ["Siemens MRI Parts", "/parts/siemens/mri"],
  ["Siemens CT Parts", "/parts/siemens/ct"],
  ["Siemens PET/CT Parts", "/parts/siemens/pet-ct"],
  ["Toshiba MRI Parts", "/parts/toshiba/mri"],
  ["Toshiba CT Parts", "/parts/toshiba/ct"],
  ["Philips MRI Parts", "/parts/philips/mri"],
  ["Philips CT Parts", "/parts/philips/ct"],
  ["Philips PET/CT Parts", "/parts/philips/pet-ct"],
];

export default async function Search() {
  let initialCatalog = { products: [], hasNextPage: false, nextCursor: null };
  try {
    initialCatalog = await fetchInitialCatalogPage();
  } catch (error) {
    console.error("Unable to render the initial parts catalog:", error);
  }

  return (
    <>
      <section className={styles.catalog_intro}>
        <div className="container">
          <p className={styles.catalog_eyebrow}>SYSTEM-TESTED PARTS AND SOURCING SUPPORT</p>
          <h1>Search MRI, CT, and PET/CT Parts</h1>
          <p>
            Search by product name, OEM part number, manufacturer, modality, or compatible
            system. Every catalog result includes a reviewed product image and a direct
            availability request path.
          </p>
          <nav aria-label="Browse parts by manufacturer and modality">
            <ul className={styles.category_links}>
              {categories.map(([label, href]) => (
                <li key={href}>
                  <Link href={href}>{label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>
      <ProductsPage initialCatalog={initialCatalog} />
    </>
  );
}
