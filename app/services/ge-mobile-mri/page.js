import Link from "next/link";
import Subheader from "@/components/subheader/Subheader";
import { BASE_URL } from "@/app/data/seoProducts";
import styles from "../oemPage.module.scss";

export const metadata = {
  title: "GE Mobile MRI Service and Trailer Support | Advanced Imaging",
  description:
    "GE mobile MRI service, maintenance, and trailer support for hospitals and imaging centers. 24/7 response for uptime-critical mobile MRI operations.",
  keywords: [
    "GE mobile MRI",
    "GE mobile MRI trailer",
    "GE mobile MRI service",
    "GE mobile MRI scanner",
  ],
  alternates: {
    canonical: "/services/ge-mobile-mri",
  },
};

const geServiceStructuredData = {
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": `${BASE_URL}/services/ge-mobile-mri#service`,
  url: `${BASE_URL}/services/ge-mobile-mri`,
  name: "GE Mobile MRI Service",
  serviceType: "GE mobile MRI trailer service and support",
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

export default function GeMobileMriPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(geServiceStructuredData) }}
      />
      <Subheader
        title={["GE Mobile ", <span key="1">MRI Service</span>]}
        extraClass="services_bg"
      />
      <section className={styles.pageSection}>
        <div className="container">
          <div className={styles.contentGrid}>
            <article className={styles.contentBlock}>
              <h2>GE Mobile MRI Trailer Coverage</h2>
              <p>
                Advanced Imaging supports GE mobile MRI trailer environments with rapid field
                service, preventative maintenance, and repair coordination built for uptime-focused
                operations.
              </p>
              <p>
                Whether your team is planning around GE mobile MRI scanner availability, trailer
                deployment, or emergency downtime, we provide experienced technical support and
                practical service communication from start to finish.
              </p>
              <ul className={styles.bulletList}>
                <li>24/7 response for GE mobile MRI service events</li>
                <li>Maintenance planning for rotating and long-term deployments</li>
                <li>Coordination for parts, diagnostics, and restoration workflows</li>
                <li>Support aligned to hospital and imaging-center schedules</li>
              </ul>
              <div className={styles.ctaLine}>
                <Link href="/contact" className="simple-btn">Contact GE Service Team</Link>
                <Link href="/services">Back to Services</Link>
              </div>
            </article>
            <aside className={styles.sideBlock}>
              <h2>Who This Page Helps</h2>
              <p>
                Imaging administrators, operations leaders, and biomedical teams searching for GE
                mobile MRI support, GE mobile MRI trailer service, and reliable uptime coverage.
              </p>
              <p>
                If you are comparing options for GE mobile MRI trailer planning or evaluating
                response quality, we can help map a practical support approach.
              </p>
              <div className={styles.trustList}>
                <div className={styles.trustItem}>
                  <h3>24/7 Service Coverage</h3>
                  <p>Fast-response workflow for uptime-sensitive GE mobile MRI operations.</p>
                </div>
                <div className={styles.trustItem}>
                  <h3>Deployment-Aware Support</h3>
                  <p>Service planning aligned with rotating trailer schedules and clinical demand.</p>
                </div>
                <div className={styles.trustItem}>
                  <h3>Direct Communication</h3>
                  <p>Clear updates for administrative and technical teams throughout the service cycle.</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
