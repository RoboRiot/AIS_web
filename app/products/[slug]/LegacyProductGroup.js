import Link from "next/link";
import { buildProductHref } from "@/app/data/seoProducts";
import styles from "./legacyProductGroup.module.scss";

export default function LegacyProductGroup({ group, products }) {
  return (
    <main className={`container ${styles.page}`}>
      <nav aria-label="Breadcrumb"><Link href="/parts">Parts</Link> / {group.title}</nav>
      <h1>{group.title}</h1>
      <p>{group.description}</p>
      <ul className={styles.products}>
        {products.map(({ product, partNumber }) => (
          <li key={product.id}>
            <Link href={buildProductHref(product)}>
              <h2>{partNumber}</h2>
              <p>{product.Name}</p>
              <p>{[product.OEM, product.Modality, product.Machine].filter(Boolean).join(" / ")}</p>
              <span>View part and request availability</span>
            </Link>
          </li>
        ))}
      </ul>
      <section className={styles.support}>
        <h2>Need help matching your part?</h2>
        <p>Have the full part number, revision and system model ready. Current availability and compatibility are confirmed with your quote.</p>
        <Link href="/contact">Contact our parts team</Link>
        <a href="tel:+15595376851">(559) 537-6851</a>
      </section>
    </main>
  );
}
