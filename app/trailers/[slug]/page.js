import Link from "next/link";
import { notFound } from "next/navigation";
import Subheader from "@/components/subheader/Subheader";
import Image from "next/image";
import TrailerImageCarousel from "./TrailerImageCarousel";
import QuickInquiryForm from "@/components/forms/QuickInquiryForm";
import { BASE_URL } from "@/app/data/seoProducts";
import {
  getTrailerLandingPage,
  trailerLandingPages,
  serviceLandingPages,
} from "@/app/data/serviceLandingPages";
import { getTrailerImages } from "@/app/data/trailerImages";
import styles from "@/app/services/landingPage.module.scss";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return trailerLandingPages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }) {
  const page = getTrailerLandingPage(params.slug);
  if (!page) return {};

  return {
    title: page.title,
    description: page.description,
    keywords: page.keywords,
    alternates: {
      canonical: `${BASE_URL}/trailers/${page.slug}`,
    },
    openGraph: {
      title: page.title,
      description: page.description,
      url: `${BASE_URL}/trailers/${page.slug}`,
      type: "website",
    },
  };
}

export default function TrailerLandingPage({ params }) {
  const page = getTrailerLandingPage(params.slug);
  if (!page) notFound();

  const trailerImages = getTrailerImages(page.slug);
  const brandLabel = page.brand || "Mobile";
  const modelCoverage = page.modelCoverage || [];
  const modelCoverageItems = modelCoverage.flatMap((group) => group.models);
  const relatedServices = serviceLandingPages.filter((service) => {
    if (page.brand) return service.brand === page.brand && service.modality === page.modality;
    return !service.brand && service.modality === page.modality;
  });
  const relatedTrailers = trailerLandingPages
    .filter((item) => item.slug !== page.slug && (item.brand === page.brand || item.modality === page.modality))
    .slice(0, 6);
  const rentalWorkflow = [
    {
      title: "Match",
      text: "Confirm modality, OEM preference, timing, clinical volume, and site constraints for the rental need.",
    },
    {
      title: "Plan",
      text: "Align short-term or long-term lease coverage with downtime, renovations, replacement, or overflow demand.",
    },
    {
      title: "Deploy",
      text: "Coordinate availability, service expectations, uptime needs, and operational communication.",
    },
    {
      title: "Support",
      text: "Back the trailer rental with technical service planning and parts coordination where needed.",
    },
  ];
  const rentalUseCaseDescriptions = [
    "Plan around scanner downtime, project schedules, site readiness, and the clinical capacity your team needs to maintain.",
    "Choose interim coverage sized for the expected term, patient volume, and transition back to your permanent system.",
    "Coordinate technical support, uptime communication, and response planning throughout the rental period.",
    "Align equipment availability, delivery sequencing, site access, and replacement-parts support before deployment.",
  ];
  const fleetPricing = page.fleetPricing || [];
  const pricingImage = trailerImages.find((image) => image.category === "Exterior") ||
    trailerImages[0] || {
      src: "/assets/images/mobile-mri2.jpg",
      alt: `${page.h1} exterior`,
    };
  const trailerJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${BASE_URL}/trailers/${page.slug}#service`,
    url: `${BASE_URL}/trailers/${page.slug}`,
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
                name: `${model.name} mobile MRI trailer rental and service planning`,
                serviceType: page.shortTitle,
              },
            })),
          },
        }
      : {}),
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "Trailer Rentals", item: `${BASE_URL}/trailers` },
      { "@type": "ListItem", position: 3, name: page.shortTitle, item: `${BASE_URL}/trailers/${page.slug}` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(trailerJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Subheader title={[page.h1.split(" ")[0], " ", <span key="1">{page.h1.split(" ").slice(1).join(" ")}</span>]} extraClass="services_bg" />
      <section className={styles.section}>
        <div className="container">
          <div className={styles.introGrid}>
            <article className={styles.heroCopy}>
              <span className={styles.kicker}>Mobile imaging rental and lease planning</span>
              <h2 className={styles.title}>Mobile {page.modality === "pet-ct" ? "PET/CT" : page.modality.toUpperCase()} Rental Coverage</h2>
              <p className={styles.lead}>{page.intro}</p>
              <div className={styles.ctaRow}>
                <a href="#request" className="simple-btn">Check Trailer Availability</a>
                <Link href="/trailers">All Trailer Rentals</Link>
              </div>
              <div className={styles.heroSystems}>
                <h3>Systems We Cover</h3>
                <ul className="list-none">
                  {page.systems.map((system) => (
                    <li key={system}>{system}</li>
                  ))}
                </ul>
              </div>
              <nav className={styles.quickNav} aria-label={`${page.h1} page sections`}>
                {modelCoverage.length > 0 && <a href="#mri-models">{brandLabel} MRI Models</a>}
                <a href="#pricing">Pricing</a>
                <a href="#rental-use-cases">Use Cases</a>
                <a href="#rental-workflow">Rental Workflow</a>
                <a href="#related">Related Pages</a>
              </nav>
            </article>
            <TrailerImageCarousel title={page.h1} galleryKey={page.slug} slides={trailerImages} />
          </div>
        </div>
      </section>
      <QuickInquiryForm
        formType="trailer_request"
        source={page.slug}
        title={`Check ${page.shortTitle} Availability`}
        intro="Share the location, target dates, modality, and preferred system. Our team will review fleet timing and the most practical coverage path."
        detailsLabel="Project details"
        detailsPlaceholder="Facility and state, target dates, expected term, preferred system, and clinical volume"
        submitLabel="Check Availability"
      />
      {modelCoverage.length > 0 && (
        <section id="mri-models" className={styles.modelCoverageSection}>
          <div className="container">
            <div className={styles.modelIntro}>
              <div>
                <span className={styles.kicker}>{brandLabel} MRI model coverage</span>
                <h2 className={styles.sectionHeading}>{brandLabel} 1.5T MRI Platforms <span>We Cover</span></h2>
                <p className={styles.sectionCopy}>
                  Mobile MRI trailer programs are built around 1.5T systems, so this list focuses on the
                  {` ${brandLabel} MRI platforms`} that fit mobile rental, lease availability, replacement coverage, and
                  trailer service searches.
                </p>
              </div>
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
              Mobile trailer availability varies by fleet timing and configuration, but AIS can help verify
              1.5T coverage paths for {brandLabel} MRI platform searches.
            </p>
          </div>
        </section>
      )}
      <section id="pricing" className={styles.pricingSection}>
        <div className="container">
          <div className={styles.pricingGrid}>
            <figure>
              <Image
                src={pricingImage.src}
                alt={pricingImage.alt || `${page.h1} mobile imaging fleet pricing`}
                width={900}
                height={620}
              />
            </figure>
            <article>
              <span className={styles.kicker}>Fleet pricing</span>
              <h2 className={styles.sectionHeading}>Our Mobile <span>Fleet</span></h2>
              <p className={styles.sectionCopy}>
                Illustrative monthly starting points for a one-year lease. Configuration,
                transport, site work, availability, and service scope affect final pricing.
              </p>
              <ul className={`${styles.pricingList} list-none`}>
                {fleetPricing.map((item) => (
                  <li key={item.system}>
                    {item.system}
                    <span>{item.price}</span>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </section>
      <section className={styles.routeSection}>
        <div className="container">
          <span className={styles.kicker}>Site and deployment planning</span>
          <h2 className={styles.sectionHeading}>Plan Before the Trailer <span>Arrives</span></h2>
          <p className={styles.sectionCopy}>
            Early coordination helps avoid delivery delays and makes the transition into temporary
            imaging capacity easier for patients, technologists, and facility teams.
          </p>
          <div className={styles.cardGrid}>
            {(page.planningPoints || []).map((point, index) => (
              <article key={point} className={styles.systemCard}>
                <h3>{["Site Readiness", "Clinical Fit", "Deployment Coordination"][index]}</h3>
                <p>{point}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section id="rental-use-cases" className={styles.systemsBand}>
        <div className="container">
          <h2 className={styles.sectionHeading}>Rental <span>Use Cases</span></h2>
          <p className={styles.sectionCopy}>
            Mobile imaging trailers are commonly used for scanner downtime, planned renovations,
            equipment replacement, overflow demand, rural access, and temporary service-line expansion.
          </p>
          <div className={styles.systemRail}>
            {page.rentalPoints.map((point, index) => (
              <article key={point} className={styles.systemTile}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{point}</h3>
                <p>
                  {rentalUseCaseDescriptions[index] ||
                    "Coordinate rental timing, site requirements, and service support around your clinical schedule."}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section id="rental-workflow" className={styles.workflowSection}>
        <div className="container">
          <h2 className={styles.sectionHeading}>Rental <span>Workflow</span></h2>
          <p className={styles.sectionCopy}>
            The goal is simple: match your facility with the right mobile imaging trailer coverage,
            reduce disruption, and keep patient access moving while the primary scanner or site is constrained.
          </p>
          <div className={styles.workflowGrid}>
            {rentalWorkflow.map((step, index) => (
              <article key={step.title} className={styles.workflowItem}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      {(relatedServices.length > 0 || relatedTrailers.length > 0) && (
        <section id="related" className={styles.routeSection}>
          <div className="container">
            <h2 className={styles.sectionHeading}>Related <span>Pages</span></h2>
            <p className={styles.sectionCopy}>
              Continue to service support or another rental page that matches your modality or OEM.
            </p>
            <div className={styles.routeGrid}>
              {relatedServices.map((item) => (
                <Link key={item.slug} href={`/services/${item.slug}`} className={styles.routeCard}>
                  <h3>{item.shortTitle}</h3>
                  <p>Preventive maintenance, emergency repair, parts support, and diagnostics.</p>
                </Link>
              ))}
              {relatedTrailers.map((item) => (
                <Link key={item.slug} href={`/trailers/${item.slug}`} className={styles.routeCard}>
                  <h3>{item.shortTitle}</h3>
                  <p>Rental planning and lease support for similar mobile imaging searches.</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
