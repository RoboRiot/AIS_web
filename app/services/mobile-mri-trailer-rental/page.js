import Link from "next/link";
import Subheader from "@/components/subheader/Subheader";
import { BASE_URL } from "@/app/data/seoProducts";
import styles from "../oemPage.module.scss";

export const metadata = {
  title: "Mobile MRI Trailer Rental and Lease Support | Advanced Imaging",
  description:
    "Mobile MRI trailer rental, short-term and long-term lease support, service planning, and 24/7 uptime coverage for hospitals and imaging centers.",
  keywords: [
    "mobile MRI trailer rental",
    "mobile MRI rental",
    "MRI trailer rental",
    "mobile MRI scanner rental",
    "mobile MRI trailer cost",
    "short term mobile MRI lease",
    "long term mobile MRI lease",
  ],
  alternates: {
    canonical: "/services/mobile-mri-trailer-rental",
  },
};

const mobileMriStructuredData = {
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": `${BASE_URL}/services/mobile-mri-trailer-rental#service`,
  url: `${BASE_URL}/services/mobile-mri-trailer-rental`,
  name: "Mobile MRI Trailer Rental and Lease Support",
  serviceType: "Mobile MRI trailer rental, lease planning, maintenance, and emergency service",
  description:
    "Short-term and long-term mobile MRI trailer support for downtime, renovations, overflow demand, and new imaging program launches.",
  provider: {
    "@type": "Organization",
    name: "Advanced Imaging",
    url: BASE_URL,
  },
  areaServed: {
    "@type": "Country",
    name: "United States",
  },
};

export default function MobileMriTrailerRentalPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(mobileMriStructuredData) }}
      />
      <Subheader
        title={["Mobile MRI Trailer ", <span key="1">Rental</span>]}
        extraClass="services_bg"
      />
      <section className={styles.pageSection}>
        <div className="container">
          <div className={styles.contentGrid}>
            <article className={styles.contentBlock}>
              <h2>Mobile MRI Rental for Downtime, Renovations, and Overflow</h2>
              <p>
                Advanced Imaging supports mobile MRI trailer rental and lease planning for
                hospitals, outpatient imaging centers, and clinical teams that need dependable
                diagnostic capacity without waiting for a fixed-site installation.
              </p>
              <p>
                Mobile MRI trailers are often used during equipment failures, construction projects,
                scanner upgrades, patient-volume surges, and new service-line launches. We help
                teams evaluate availability, service requirements, maintenance coverage, and uptime
                expectations before and during deployment.
              </p>
              <ul className={styles.bulletList}>
                <li>Short-term and long-term mobile MRI trailer rental support</li>
                <li>Lease planning for GE, Philips, and Siemens mobile MRI systems</li>
                <li>24/7 technical service coverage for uptime-sensitive deployments</li>
                <li>Support for cost planning, replacement timing, and operational continuity</li>
              </ul>
              <div className={styles.ctaLine}>
                <Link href="/contact" className="simple-btn">Request Mobile MRI Support</Link>
                <Link href="/services">Back to Services</Link>
              </div>
            </article>
            <aside className={styles.sideBlock}>
              <h2>Common Rental Scenarios</h2>
              <p>
                Facilities usually search for mobile MRI rental when imaging access is at risk or
                patient demand exceeds fixed-site capacity.
              </p>
              <div className={styles.trustList}>
                <div className={styles.trustItem}>
                  <h3>Emergency Scanner Downtime</h3>
                  <p>Temporary MRI capacity while a primary scanner is being repaired.</p>
                </div>
                <div className={styles.trustItem}>
                  <h3>Construction or Replacement</h3>
                  <p>Mobile MRI coverage during room buildouts, upgrades, and transitions.</p>
                </div>
                <div className={styles.trustItem}>
                  <h3>Volume Expansion</h3>
                  <p>Additional capacity for overflow demand, rural access, or program growth.</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
