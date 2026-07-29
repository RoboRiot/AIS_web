import Link from "next/link";
import styles from "./search.module.scss";

const catalogGroups = [
  {
    slug: "ge",
    name: "GE",
    modalities: [
      { slug: "mri", label: "MRI" },
      { slug: "ct", label: "CT" },
      { slug: "pet-ct", label: "PET/CT" },
    ],
  },
  {
    slug: "siemens",
    name: "Siemens",
    modalities: [
      { slug: "mri", label: "MRI" },
      { slug: "ct", label: "CT" },
      { slug: "pet-ct", label: "PET/CT" },
    ],
  },
  {
    slug: "toshiba",
    name: "Toshiba",
    modalities: [
      { slug: "mri", label: "MRI" },
      { slug: "ct", label: "CT" },
    ],
  },
  {
    slug: "philips",
    name: "Philips",
    modalities: [
      { slug: "mri", label: "MRI" },
      { slug: "ct", label: "CT" },
      { slug: "pet-ct", label: "PET/CT" },
    ],
  },
];

export default function PartsCatalogNav({
  activeOem = "",
  activeModality = "",
}) {
  return (
    <nav
      className={styles.catalog_nav}
      aria-label="Browse parts by manufacturer and modality"
    >
      <ul className={styles.catalog_nav_groups}>
        {catalogGroups.map((group) => {
          const isActiveOem = group.name === activeOem;
          return (
            <li
              key={group.slug}
              className={isActiveOem ? styles.catalog_nav_active : undefined}
            >
              <details>
                <summary>
                  <span>{group.name}</span>
                  <small>{group.modalities.map((item) => item.label).join(" / ")}</small>
                </summary>
                <div className={styles.catalog_nav_dropdown}>
                  {group.modalities.map((modality) => {
                    const isCurrent =
                      isActiveOem && modality.label === activeModality;
                    return (
                      <Link
                        key={modality.slug}
                        href={`/parts/${group.slug}/${modality.slug}`}
                        aria-current={isCurrent ? "page" : undefined}
                      >
                        <strong>{modality.label}</strong>
                        <span>{group.name} {modality.label} parts</span>
                      </Link>
                    );
                  })}
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
