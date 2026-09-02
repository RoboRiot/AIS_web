import Link from "next/link";
import Subheader from "@/components/subheader/Subheader";
import MobileMri from "@/app/services/mobile-mri/MobileMri";
import { BASE_URL } from "@/app/data/seoProducts";
import { serviceModalities, trailerLandingPages } from "@/app/data/serviceLandingPages";
import styles from "@/app/services/landingPage.module.scss";
import { DEFAULT_SOCIAL_IMAGES } from "@/app/data/siteMetadata";

export const metadata = {
  title: "Mobile MRI & CT Trailer Rental | Nationwide Lease Support",
  description:
    "Request nationwide mobile MRI, CT, or PET/CT trailer rental for downtime, renovations, overflow, or replacement projects. Short- and long-term lease support.",
  keywords: [
    "mobile MRI trailer rental",
    "mobile CT trailer rental",
    "mobile PET CT trailer rental",
    "mobile imaging trailer rental",
    "MRI trailer lease",
    "CT trailer lease",
    "PET CT mobile unit rental",
    "mobile imaging trailer service",
    "mobile imaging trailer for sale",
  ],
  alternates: {
    canonical: `${BASE_URL}/trailers`,
  },
  openGraph: {
    title: "Mobile MRI & CT Trailer Rental | Nationwide Lease Support",
    description:
      "Nationwide mobile MRI, CT, and PET/CT trailer rentals for downtime, renovations, overflow, and replacement projects.",
    url: `${BASE_URL}/trailers`,
    type: "website",
    images: DEFAULT_SOCIAL_IMAGES,
  },
  twitter: {
    card: "summary_large_image",
    title: "Mobile MRI & CT Trailer Rental | Nationwide Lease Support",
    description:
      "Nationwide mobile MRI, CT, and PET/CT trailer rentals for downtime, renovations, overflow, and replacement projects.",
    images: DEFAULT_SOCIAL_IMAGES,
  },
};

const trailerJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": `${BASE_URL}/trailers#mobile-imaging-trailer-rentals`,
  url: `${BASE_URL}/trailers`,
  name: "Mobile Imaging Trailer Rentals, Lease and Service",
  serviceType: "Mobile MRI, CT, and PET/CT trailer rental, lease, service, and purchase planning support",
  description:
    "Mobile imaging trailer rental support for downtime, renovations, overflow demand, rural access, and new imaging program launches.",
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
};

export default function TrailersPage() {
  const genericPages = trailerLandingPages.filter((page) => !page.brand);
  const brandPages = trailerLandingPages.filter((page) => page.brand);
  const modalityGroups = Object.entries(serviceModalities);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(trailerJsonLd) }}
      />
      <Subheader title={["Mobile Imaging ", <span key="1">Trailer Rentals</span>]} extraClass="services_bg" />
      <MobileMri />
      <section id="rental-options" className={styles.systemsBand}>
        <div className="container">
          <span className={styles.kicker}>Explore only when you need details</span>
          <h2 className={styles.sectionHeading}>Choose a Mobile Imaging <span>Modality</span></h2>
          <p className={styles.sectionCopy}>
            Most facilities just need fast rental availability, lease guidance, and service-backed uptime.
            If your team wants a more specific path, start with MRI, CT, or PET/CT, then open the OEM
            pages for GE, Siemens, or Toshiba/Canon.
          </p>
          <div className={styles.modalitySelector}>
            {modalityGroups.map(([modality, config]) => {
              const generalPage = genericPages.find((page) => page.modality === modality);
              const oemPages = brandPages.filter((page) => page.modality === modality);

              return (
                <details key={modality} className={styles.modalityDetails}>
                  <summary>
                    <span>{config.label}</span>
                    <strong>Mobile {config.label} trailer rental, lease, and service</strong>
                  </summary>
                  <div className={styles.modalityReveal}>
                    {generalPage && (
                      <Link href={`/trailers/${generalPage.slug}`} className={styles.featuredRoute}>
                        {generalPage.shortTitle}
                      </Link>
                    )}
                    <div className={styles.oemRoutes}>
                      {oemPages.map((page) => (
                        <Link key={page.slug} href={`/trailers/${page.slug}`}>
                          {page.shortTitle}
                        </Link>
                      ))}
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
          <div className={styles.trailerClosingCta}>
            <p>Need help choosing the right mobile unit or checking availability?</p>
            <Link href="/contact" className="simple-btn">Request Trailer Availability</Link>
          </div>
        </div>
      </section>
    </>
  );
}
