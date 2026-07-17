import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import Subheader from "@/components/subheader/Subheader";
import serviceImage from "@/public/assets/images/e-mri.jpg";
import MriServiceCarousel from "./MriServiceCarousel";
import { BASE_URL } from "@/app/data/seoProducts";
import {
  getServiceLandingPage,
  serviceLandingPages,
} from "@/app/data/serviceLandingPages";
import styles from "../landingPage.module.scss";

export const revalidate = 3600;

export function generateStaticParams() {
  return serviceLandingPages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }) {
  const page = getServiceLandingPage(params.slug);
  if (!page) return {};

  return {
    title: page.title,
    description: page.description,
    keywords: page.keywords,
    alternates: {
      canonical: `${BASE_URL}/services/${page.slug}`,
    },
    openGraph: {
      title: page.title,
      description: page.description,
      url: `${BASE_URL}/services/${page.slug}`,
      type: "website",
    },
  };
}

export default function ServiceLandingPage({ params }) {
  const page = getServiceLandingPage(params.slug);
  if (!page) notFound();

  const brandLabel = page.brand || "Imaging";
  const isMriPage = page.modality === "mri";
  const modelCoverage = page.modelCoverage || [];
  const modelCoverageItems = modelCoverage.flatMap((group) => group.models);
  const relatedServices = serviceLandingPages.filter((item) => {
    if (item.slug === page.slug) return false;
    if (page.brand) return item.brand === page.brand || item.modality === page.modality;
    return item.modality === page.modality;
  }).slice(0, 6);
  const workflowSteps = [
    {
      title: "Remote Support",
      text: "Start with instant remote support to review symptoms, alarms, scanner history, and system status. Many issues can be resolved remotely and get the machine operating again right away.",
    },
    {
      title: "Stabilize",
      text: "If the system still needs attention, prioritize uptime-sensitive troubleshooting, clinical scheduling needs, and clear communication for your imaging team.",
    },
    {
      title: "Support",
      text: "Coordinate field service, preventive maintenance, repair paths, compatible tested parts, and system-specific service needs when remote recovery is not enough.",
    },
    {
      title: "Restore",
      text: "Help reduce downtime and keep MRI, CT, and PET/CT schedules moving with clear next steps.",
    },
  ];
  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${BASE_URL}/services/${page.slug}#service`,
    url: `${BASE_URL}/services/${page.slug}`,
    name: page.shortTitle,
    serviceType: page.shortTitle,
    description: page.description,
    provider: {
      "@id": `${BASE_URL}/#organization`,
      "@type": "Organization",
      name: "Advanced Imaging Services",
      url: BASE_URL,
    },
    areaServed: {
      "@type": "Country",
      name: "United States",
    },
    ...(modelCoverageItems.length > 0
      ? {
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: `${page.shortTitle} model coverage`,
            itemListElement: modelCoverageItems.map((model) => ({
              "@type": "Offer",
              itemOffered: {
                "@type": "Service",
                name: `${model.name} MRI service, repair, and maintenance`,
                serviceType: page.shortTitle,
              },
            })),
          },
        }
      : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      <Subheader title={[page.h1.split(" ")[0], " ", <span key="1">{page.h1.split(" ").slice(1).join(" ")}</span>]} extraClass="services_bg" />
      <section className={styles.section}>
        <div className="container">
          <div className={styles.introGrid}>
            <article className={styles.heroCopy}>
              <span className={styles.kicker}>{page.eyebrow}</span>
              <h2 className={styles.title}>{page.h1}</h2>
              <p className={styles.lead}>{page.intro}</p>
              <div className={styles.ctaRow}>
                <Link href="/contact" className="simple-btn">Request Service</Link>
                <Link href="/services">View All Services</Link>
              </div>
              <nav className={styles.quickNav} aria-label={`${page.h1} page sections`}>
                {modelCoverage.length > 0 && <a href="#mri-service-models">{brandLabel} MRI Models</a>}
                <a href="#capabilities">Capabilities</a>
                <a href="#workflow">Workflow</a>
                <a href="#related">Related Pages</a>
              </nav>
            </article>
            {isMriPage ? (
              <MriServiceCarousel title={page.h1} />
            ) : (
              <figure className={styles.figure}>
                <Image src={serviceImage} alt={`${page.h1} engineers and imaging equipment support`} priority />
              </figure>
            )}
          </div>
        </div>
      </section>
      {modelCoverage.length > 0 && (
        <section id="mri-service-models" className={styles.modelCoverageSection}>
          <div className="container">
            <div className={styles.modelIntro}>
              <div>
                <span className={styles.kicker}>{brandLabel} MRI service model coverage</span>
                <h2 className={styles.sectionHeading}>{brandLabel} MRI Platforms <span>We Service</span></h2>
                <p className={styles.sectionCopy}>
                  AIS supports {brandLabel} MRI service, repair, preventive maintenance, troubleshooting, and parts
                  planning across the major {brandLabel} MRI platform families. This service list includes 1.5T,
                  3.0T, and specialty {brandLabel} MRI platforms because those systems are serviceable even when
                  they are not candidates for mobile trailer deployment.
                </p>
              </div>
              <aside className={styles.modelStats} aria-label={`${brandLabel} MRI service model coverage summary`}>
                <strong>{modelCoverageItems.length}</strong>
                <span>{brandLabel} MRI service model names represented</span>
              </aside>
            </div>
            <div className={`${styles.modelGroups} ${modelCoverage.length === 1 ? styles.modelGroupsSingle : ""}`}>
              {modelCoverage.map((group) => (
                <article key={group.category} className={styles.modelGroup}>
                  <div className={styles.modelGroupHeader}>
                    <h3>{group.category}</h3>
                    <p>{group.summary}</p>
                  </div>
                  <ul className={`${styles.modelList} list-none`}>
                    {group.models.map((model) => (
                      <li key={model.name}>
                        <h4>{model.name}</h4>
                        {model.aliases?.length > 0 && (
                          <p>Also searched as: {model.aliases.join(", ")}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            <p className={styles.coverageNote}>
              If your exact {brandLabel} MRI configuration is not listed, AIS can confirm service coverage, parts
              support, and uptime planning for the scanner installed at your site.
            </p>
          </div>
        </section>
      )}
      <section id="capabilities" className={styles.section}>
        <div className="container">
          <div className={styles.splitGrid}>
            <article>
              <h2 className={styles.sectionHeading}>Service <span>Capabilities</span></h2>
              <p className={styles.sectionCopy}>
                Advanced Imaging Services supports practical field-service needs: preventive maintenance,
                emergency troubleshooting, diagnostics, tested replacement parts, and clear communication
                for clinical teams that need equipment back online.
              </p>
            </article>
            <aside className={styles.panel}>
              <h2>What We Handle</h2>
              <ul className={`${styles.bulletList} list-none`}>
                {page.servicePoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </aside>
          </div>
        </div>
      </section>
      <section id="workflow" className={styles.workflowSection}>
        <div className="container">
          <h2 className={styles.sectionHeading}>How We <span>Support Uptime</span></h2>
          <p className={styles.sectionCopy}>
            Support begins remotely. AIS can often connect quickly, review symptoms, guide your team through
            recovery steps, and get the scanner operating immediately without waiting for a field visit. When
            remote support is not enough, we move into dispatch, parts, and repair planning.
          </p>
          <div className={styles.workflowGrid}>
            {workflowSteps.map((step, index) => (
              <article key={step.title} className={styles.workflowItem}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      {relatedServices.length > 0 && (
        <section id="related" className={styles.routeSection}>
          <div className="container">
            <h2 className={styles.sectionHeading}>Related <span>Service Pages</span></h2>
            <p className={styles.sectionCopy}>
              Continue into the most relevant service page for your modality or OEM platform.
            </p>
            <div className={styles.routeGrid}>
              {relatedServices.map((item) => (
                <Link key={item.slug} href={`/services/${item.slug}`} className={styles.routeCard}>
                  <h3>{item.shortTitle}</h3>
                  <p>Focused service support for this modality or OEM platform.</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
