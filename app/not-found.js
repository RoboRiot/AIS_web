import Link from "next/link";
import NotFoundAnalytics from "@/components/analytics/NotFoundAnalytics";
import styles from "./not-found.module.scss";

export const metadata = {
  title: "Page Not Found | Advanced Imaging Services",
  robots: {
    index: false,
    follow: true,
  },
};

export default function NotFound() {
  return (
    <section className={styles.page} aria-labelledby="not-found-title">
      <NotFoundAnalytics />
      <div className={styles.inner}>
        <p className={styles.eyebrow}>Page not found</p>
        <h1 id="not-found-title">The page you requested is no longer here.</h1>
        <p className={styles.intro}>
          Find medical imaging parts, compare mobile trailer options, or reach our
          service team for immediate MRI, CT, and PET/CT support.
        </p>
        <nav className={styles.actions} aria-label="Helpful destinations">
          <Link
            href="/parts"
            className="simple-btn"
            data-analytics="not-found-parts"
          >
            Search Parts
          </Link>
          <Link href="/trailers" data-analytics="not-found-trailers">
            Trailer Rentals
          </Link>
          <Link href="/service-request" data-analytics="not-found-service">
            Request Service
          </Link>
        </nav>
        <p className={styles.contact}>
          Need help now? <a href="tel:+15595376851">Call (559) 537-6851</a>
        </p>
      </div>
    </section>
  );
}
