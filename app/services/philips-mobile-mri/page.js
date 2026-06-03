import Link from "next/link";
import Subheader from "@/components/subheader/Subheader";
import { BASE_URL } from "@/app/data/seoProducts";
import styles from "../oemPage.module.scss";

export const metadata = {
  title: "Philips Mobile MRI Service and Trailer Support | Advanced Imaging",
  description:
    "Philips mobile MRI service and trailer support for clinical imaging programs. Fast diagnostics, maintenance, and 24/7 response.",
  keywords: [
    "Philips mobile MRI",
    "Philips mobile MRI trailer",
    "Philips mobile MRI rental",
    "Philips mobile MRI service",
  ],
  alternates: {
    canonical: "/services/philips-mobile-mri",
  },
};

const philipsServiceStructuredData = {
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": `${BASE_URL}/services/philips-mobile-mri#service`,
  url: `${BASE_URL}/services/philips-mobile-mri`,
  name: "Philips Mobile MRI Service",
  serviceType: "Philips mobile MRI trailer service and support",
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

export default function PhilipsMobileMriPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(philipsServiceStructuredData) }}
      />
      <Subheader
        title={["Philips Mobile ", <span key="1">MRI Service</span>]}
        extraClass="services_bg"
      />
      <section className={styles.pageSection}>
        <div className="container">
          <div className={styles.contentGrid}>
            <article className={styles.contentBlock}>
              <h2>Philips Mobile MRI Trailer Coverage</h2>
              <p>
                Advanced Imaging provides service support for Philips mobile MRI environments,
                including field troubleshooting, maintenance scheduling, and operational continuity
                planning for mobile trailer programs.
              </p>
              <p>
                Teams searching for Philips mobile MRI unit support, Philips mobile MRI rental
                service quality, or trailer uptime planning can use this page as a direct service
                contact path.
              </p>
              <ul className={styles.bulletList}>
                <li>24/7 technical support for Philips mobile MRI service issues</li>
                <li>Preventive maintenance and service interval planning</li>
                <li>Downtime triage for mobile trailer and site-level constraints</li>
                <li>Clear communication for administrators and imaging teams</li>
              </ul>
              <div className={styles.ctaLine}>
                <Link href="/contact" className="simple-btn">Contact Philips Service Team</Link>
                <Link href="/services">Back to Services</Link>
              </div>
            </article>
            <aside className={styles.sideBlock}>
              <h2>Who This Page Helps</h2>
              <p>
                Mobile imaging managers and facility teams seeking Philips mobile MRI service,
                reliability planning, and fast-response support in high-throughput environments.
              </p>
              <p>
                We can help align service expectations with your scheduling, patient volume, and
                mobile deployment priorities.
              </p>
              <div className={styles.trustList}>
                <div className={styles.trustItem}>
                  <h3>24/7 Response Model</h3>
                  <p>Immediate support workflow for service interruptions and urgent issues.</p>
                </div>
                <div className={styles.trustItem}>
                  <h3>Operational Continuity</h3>
                  <p>Service process designed to protect scheduling capacity and throughput.</p>
                </div>
                <div className={styles.trustItem}>
                  <h3>Execution Transparency</h3>
                  <p>Practical status updates and next-step guidance from intake through closure.</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
