import Link from "next/link";
import Subheader from "@/components/subheader/Subheader";
import { BASE_URL } from "@/app/data/seoProducts";
import styles from "../oemPage.module.scss";

export const metadata = {
  title: "Mobile CT Trailer Rental and Service | Advanced Imaging",
  description:
    "Mobile CT trailer rental and service support for hospitals and imaging centers. Flexible planning, preventive maintenance, and 24/7 rapid-response coverage.",
  keywords: [
    "mobile CT trailer",
    "mobile CT trailer rental",
    "CT trailer rental",
    "mobile CT scan trailer",
    "portable CT trailer",
  ],
  alternates: {
    canonical: "/services/mobile-ct-trailer-rental",
  },
};

const ctTrailerStructuredData = {
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": `${BASE_URL}/services/mobile-ct-trailer-rental#service`,
  url: `${BASE_URL}/services/mobile-ct-trailer-rental`,
  name: "Mobile CT Trailer Rental and Service",
  serviceType: "Mobile CT trailer rental, maintenance, and emergency support",
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

export default function MobileCtTrailerRentalPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ctTrailerStructuredData) }}
      />
      <Subheader
        title={["Mobile CT Trailer ", <span key="1">Rental</span>]}
        extraClass="services_bg"
      />
      <section className={styles.pageSection}>
        <div className="container">
          <div className={styles.contentGrid}>
            <article className={styles.contentBlock}>
              <h2>CT Trailer Rental With Service Continuity</h2>
              <p>
                Advanced Imaging provides mobile CT trailer rental and technical support for
                healthcare teams that need dependable uptime and practical response during high-use
                periods.
              </p>
              <p>
                From planned deployments to emergency replacement coverage, our process helps keep
                scanning capacity stable while minimizing disruption to patient scheduling.
              </p>
              <ul className={styles.bulletList}>
                <li>Flexible CT trailer rental support for short and long terms</li>
                <li>24/7 service response for uptime-critical environments</li>
                <li>Preventive maintenance and troubleshooting coordination</li>
                <li>Support for mobile CT scan trailer operations and logistics</li>
              </ul>
              <div className={styles.ctaLine}>
                <Link href="/contact" className="simple-btn">Request CT Trailer Support</Link>
                <Link href="/services">Back to Services</Link>
              </div>
            </article>
            <aside className={styles.sideBlock}>
              <h2>Trust Signals</h2>
              <div className={styles.trustList}>
                <div className={styles.trustItem}>
                  <h3>24/7 Availability</h3>
                  <p>Rapid-response support for urgent downtime and continuity events.</p>
                </div>
                <div className={styles.trustItem}>
                  <h3>Operational Focus</h3>
                  <p>Service process built around throughput and scheduling stability.</p>
                </div>
                <div className={styles.trustItem}>
                  <h3>Clear Communication</h3>
                  <p>Direct updates and practical next steps during active service calls.</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
