import { fetchRelevantCatalogPage } from "@/app/data/serverFirestoreProducts";
import PartsCatalogNav from "./PartsCatalogNav";
import ProductsPage from "./ProductsPage";
import styles from "./search.module.scss";

export const revalidate = 3600;

export default async function Search() {
  let initialCatalog = {
    products: [],
    hasNextPage: false,
    nextCursor: null,
    totalMatches: 0,
    sort: "relevant",
  };
  try {
    initialCatalog = await fetchRelevantCatalogPage();
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
          <PartsCatalogNav />
        </div>
      </section>
      <ProductsPage initialCatalog={initialCatalog} />
    </>
  );
}
