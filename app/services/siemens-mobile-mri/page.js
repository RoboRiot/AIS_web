import Link from "next/link";
import Subheader from "@/components/subheader/Subheader";
import { BASE_URL } from "@/app/data/seoProducts";
import styles from "../oemPage.module.scss";

export const metadata = {
  title: "Siemens Mobile MRI Service and Trailer Support | Advanced Imaging",
  description:
    "Siemens mobile MRI trailer service for healthcare facilities that need dependable uptime. 24/7 support, maintenance, and rapid-response diagnostics.",
  keywords: [
    "Siemens mobile MRI",
    "Siemens mobile MRI trailer",
    "Siemens mobile MRI scanner",
    "Siemens mobile MRI service",
  ],
  alternates: {
    canonical: "/services/siemens-mobile-mri",
  },
};

const siemensServiceStructuredData = {
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": `${BASE_URL}/services/siemens-mobile-mri#service`,
  url: `${BASE_URL}/services/siemens-mobile-mri`,
  name: "Siemens Mobile MRI Service",
  serviceType: "Siemens mobile MRI trailer service and support",
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

export default function SiemensMobileMriPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(siemensServiceStructuredData) }}
      />
      <Subheader
        title={["Siemens Mobile ", <span key="1">MRI Service</span>]}
        extraClass="services_bg"
      />
      <section className={styles.pageSection}>
        <div className="container">
          <div className={styles.contentGrid}>
            <article className={styles.contentBlock}>
              <h2>Siemens Mobile MRI Trailer Coverage</h2>
              <p>
                We provide Siemens mobile MRI support for facilities operating mobile trailer
                programs that require reliability, speed, and predictable service outcomes.
              </p>
              <p>
                From Siemens mobile MRI scanner uptime events to planned maintenance windows,
                Advanced Imaging works with your team to reduce service friction and protect
                patient throughput.
              </p>
              <ul className={styles.bulletList}>
                <li>24/7 response for Siemens mobile MRI service interruptions</li>
                <li>Field support and maintenance planning for mobile deployments</li>
                <li>Operational guidance for downtime minimization</li>
                <li>Responsive communication throughout the service lifecycle</li>
              </ul>
              <div className={styles.ctaLine}>
                <Link href="/contact" className="simple-btn">Contact Siemens Service Team</Link>
                <Link href="/services">Back to Services</Link>
              </div>
            </article>
            <aside className={styles.sideBlock}>
              <h2>Who This Page Helps</h2>
              <p>
                Healthcare organizations and imaging leaders searching for Siemens mobile MRI
                trailer service, maintenance continuity, and practical uptime support.
              </p>
              <p>
                If you are evaluating support partners, we can help define a service path that
                fits your operating model.
              </p>
              <div className={styles.trustList}>
                <div className={styles.trustItem}>
                  <h3>Always-On Support</h3>
                  <p>24/7 response path for downtime events affecting mobile MRI availability.</p>
                </div>
                <div className={styles.trustItem}>
                  <h3>Downtime Reduction Focus</h3>
                  <p>Service planning built around uptime, throughput, and continuity metrics.</p>
                </div>
                <div className={styles.trustItem}>
                  <h3>Service Ownership</h3>
                  <p>Clear accountability and communication through each stage of service work.</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
