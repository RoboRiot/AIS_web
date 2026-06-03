import Link from "next/link";
import Subheader from "@/components/subheader/Subheader";
import { BASE_URL } from "@/app/data/seoProducts";
import styles from "../oemPage.module.scss";

export const metadata = {
  title: "Mobile PET/CT Trailer Service and Support | Advanced Imaging",
  description:
    "Mobile PET/CT trailer service support for healthcare organizations that require dependable uptime, maintenance planning, and responsive field coordination.",
  keywords: [
    "mobile PET CT trailer",
    "mobile PET CT services",
    "mobile PET CT imaging",
    "PET CT trailer service",
  ],
  alternates: {
    canonical: "/services/mobile-pet-ct-trailer",
  },
};

const petCtStructuredData = {
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": `${BASE_URL}/services/mobile-pet-ct-trailer#service`,
  url: `${BASE_URL}/services/mobile-pet-ct-trailer`,
  name: "Mobile PET/CT Trailer Service",
  serviceType: "Mobile PET/CT trailer operational and technical support",
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

export default function MobilePetCtTrailerPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(petCtStructuredData) }}
      />
      <Subheader
        title={["Mobile PET/CT ", <span key="1">Trailer Service</span>]}
        extraClass="services_bg"
      />
      <section className={styles.pageSection}>
        <div className="container">
          <div className={styles.contentGrid}>
            <article className={styles.contentBlock}>
              <h2>PET/CT Trailer Support for Reliable Throughput</h2>
              <p>
                Advanced Imaging supports mobile PET/CT trailer programs with maintenance,
                troubleshooting, and practical coordination designed to reduce operational friction.
              </p>
              <p>
                For teams searching mobile PET CT services, this page is built to provide a direct
                path to service planning and rapid technical response.
              </p>
              <ul className={styles.bulletList}>
                <li>Service support for mobile PET/CT trailer workflows</li>
                <li>24/7 response strategy for urgent uptime events</li>
                <li>Maintenance planning for recurring deployment schedules</li>
                <li>Support aligned with imaging-center operational priorities</li>
              </ul>
              <div className={styles.ctaLine}>
                <Link href="/contact" className="simple-btn">Request PET/CT Support</Link>
                <Link href="/services">Back to Services</Link>
              </div>
            </article>
            <aside className={styles.sideBlock}>
              <h2>Trust Signals</h2>
              <div className={styles.trustList}>
                <div className={styles.trustItem}>
                  <h3>Always-On Response</h3>
                  <p>Support workflow built for time-sensitive service environments.</p>
                </div>
                <div className={styles.trustItem}>
                  <h3>Deployment-Aware Service</h3>
                  <p>Coverage that adapts to rotating sites and changing schedules.</p>
                </div>
                <div className={styles.trustItem}>
                  <h3>Execution Clarity</h3>
                  <p>Action-oriented communication from intake through resolution.</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
