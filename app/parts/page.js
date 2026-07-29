import Link from "next/link";
import { fetchRelevantCatalogPage } from "@/app/data/serverFirestoreProducts";
import ProductsPage from "./ProductsPage";
import styles from "./search.module.scss";

export const revalidate = 3600;

const manufacturers = [
  {
    name: "GE",
    modalities: [
      ["MRI", "/parts/ge/mri"],
      ["CT", "/parts/ge/ct"],
      ["PET/CT", "/parts/ge/pet-ct"],
    ],
  },
  {
    name: "Siemens",
    modalities: [
      ["MRI", "/parts/siemens/mri"],
      ["CT", "/parts/siemens/ct"],
      ["PET/CT", "/parts/siemens/pet-ct"],
    ],
  },
  {
    name: "Toshiba",
    modalities: [
      ["MRI", "/parts/toshiba/mri"],
      ["CT", "/parts/toshiba/ct"],
    ],
  },
  {
    name: "Philips",
    modalities: [
      ["MRI", "/parts/philips/mri"],
      ["CT", "/parts/philips/ct"],
      ["PET/CT", "/parts/philips/pet-ct"],
    ],
  },
];

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
          <nav
            className={styles.system_selector}
            aria-label="Browse parts by manufacturer and modality"
          >
            <div className={styles.selector_intro}>
              <span>Browse catalog</span>
              <strong>Choose your system</strong>
            </div>
            <ul className={styles.selector_groups}>
              {manufacturers.map((manufacturer) => (
                <li key={manufacturer.name} className={styles.selector_group}>
                  <span className={styles.selector_oem}>{manufacturer.name}</span>
                  <div
                    className={styles.selector_links}
                    data-count={manufacturer.modalities.length}
                  >
                    {manufacturer.modalities.map(([label, href]) => (
                      <Link key={href} href={href}>
                        {label}
                      </Link>
                    ))}
                  </div>
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
