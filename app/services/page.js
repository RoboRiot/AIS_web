import Subheader from "@/components/subheader/Subheader";
import ExpertMriServices from "./expert-mri-services/ExpertMriServices";
import CtServices from "./ct-services/CtServices";
import Link from "next/link";
import styles from "./servicesSeo.module.scss";
import { BASE_URL } from "@/app/data/seoProducts";
import { serviceLandingPages, serviceModalities } from "@/app/data/serviceLandingPages";

export const metadata = {
    title: "MRI, CT & PET/CT Service | Advanced Imaging Services",
    description:
        "Advanced Imaging Services provides MRI, CT, and PET/CT equipment service, repair, preventive maintenance, emergency support, and tested medical imaging parts across the U.S.",
    keywords: [
        "MRI service",
        "CT service",
        "PET service",
        "PET/CT service",
        "medical imaging equipment service",
        "MRI repair",
        "CT scanner repair",
        "preventive maintenance",
        "emergency imaging service",
        "GE MRI service",
        "Siemens MRI service",
        "Toshiba MRI service",
        "GE CT service",
        "Siemens CT service",
        "Toshiba CT service",
    ],
    alternates: {
        canonical: "/services",
    },
    openGraph: {
        title: "MRI, CT & PET/CT Service | Advanced Imaging Services",
        description:
            "MRI, CT, PET/CT service, repair, preventive maintenance, emergency support, and tested medical imaging parts.",
        url: "/services",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "MRI, CT & PET/CT Service | Advanced Imaging Services",
        description:
            "Nationwide MRI, CT, and PET/CT service support.",
    },
};

const servicesStructuredData = {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${BASE_URL}/services#medical-imaging-equipment-service`,
    url: `${BASE_URL}/services`,
    serviceType: "MRI, CT, and PET/CT medical imaging equipment service",
    name: "MRI, CT & PET/CT Service",
    description:
        "Advanced Imaging Services provides MRI maintenance and repair, CT scanner service and repair, PET/CT service, preventive maintenance, emergency troubleshooting, and tested replacement parts support.",
    provider: {
        "@type": "Organization",
        "@id": `${BASE_URL}/#organization`,
        name: "Advanced Imaging Services",
        url: BASE_URL,
        telephone: "+1-800-200-3583",
    },
    areaServed: {
        "@type": "Country",
        name: "United States",
    },
    hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Medical Imaging Service Catalog",
        itemListElement: [
            {
                "@type": "Offer",
                itemOffered: {
                    "@type": "Service",
                    name: "MRI maintenance and repair",
                },
            },
            {
                "@type": "Offer",
                itemOffered: {
                    "@type": "Service",
                    name: "CT scanner service and repair",
                },
            },
            {
                "@type": "Offer",
                itemOffered: {
                    "@type": "Service",
                    name: "PET/CT service",
                },
            },
            {
                "@type": "Offer",
                itemOffered: {
                    "@type": "Service",
                    name: "Preventive maintenance and emergency repair",
                },
            },
            {
                "@type": "Offer",
                itemOffered: {
                    "@type": "Service",
                    name: "System-tested medical imaging parts support",
                },
            },
        ],
    },
    additionalType: [
        "MRI repair",
        "CT scanner repair",
        "Preventive maintenance",
        "Emergency imaging equipment service",
    ],
};

const localBusinessStructuredData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${BASE_URL}/#localbusiness`,
    name: "Advanced Imaging Services",
    url: BASE_URL,
    image: `${BASE_URL}/assets/images/logo.svg`,
    logo: `${BASE_URL}/assets/images/logo.svg`,
    telephone: "+1-800-200-3583",
    email: "info@advancedimagingparts.com",
    address: {
        "@type": "PostalAddress",
        streetAddress: "17410 Murphy Pkwy.",
        addressLocality: "Lathrop",
        addressRegion: "CA",
        postalCode: "95330",
        addressCountry: "US",
    },
    areaServed: {
        "@type": "Country",
        name: "United States",
    },
    makesOffer: {
        "@id": `${BASE_URL}/services#medical-imaging-equipment-service`,
    },
};

const breadcrumbStructuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
        {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: BASE_URL,
        },
        {
            "@type": "ListItem",
            position: 2,
            name: "Services",
            item: `${BASE_URL}/services`,
        },
    ],
};

const faqItems = [
    {
        question: "Do you service GE, Siemens, and Toshiba imaging systems?",
        answer:
            "Yes. Advanced Imaging Services supports MRI, CT, and PET/CT service workflows across major OEM platforms, including GE, Siemens, and Toshiba/Canon systems.",
    },
    {
        question: "Do you provide emergency imaging equipment repair?",
        answer:
            "Yes. We support urgent troubleshooting, replacement-part coordination, and practical service response for facilities dealing with scanner downtime.",
    },
    {
        question: "Can you help with preventive maintenance?",
        answer:
            "Yes. Preventive maintenance support helps protect image quality, reduce unplanned downtime, and keep clinical schedules moving.",
    },
    {
        question: "Do you support tested replacement parts?",
        answer:
            "Yes. We coordinate tested parts support for MRI, CT, and PET/CT systems, including coils, tubes, boards, detectors, power supplies, and related assemblies.",
    },
    {
        question: "What service areas do you cover?",
        answer:
            "We work with hospitals, imaging centers, and service buyers across the United States for MRI, CT, and PET/CT service support.",
    },
];

const primaryServiceLinks = serviceLandingPages.filter((page) => !page.brand);
const brandServiceLinks = serviceLandingPages.filter((page) => page.brand);
const directoryModalities = Object.entries(serviceModalities);

const serviceSupportSections = [
    {
        title: "MRI Service",
        text: "Advanced Imaging Services supports MRI maintenance and repair, system diagnostics, troubleshooting, coil support, RF and gradient-related parts coordination, image-quality support, and downtime reduction planning.",
    },
    {
        title: "CT Service",
        text: "Our CT scanner service and repair support covers preventive maintenance, emergency troubleshooting, component replacement, calibration coordination, CT tube support, detector and board replacement, and practical help for high-volume imaging departments.",
    },
    {
        title: "PET/CT Service",
        text: "We support PET service and PET/CT service needs for oncology and diagnostic imaging providers, including uptime planning, tested replacement parts, and service coordination for major imaging platforms.",
    },
    {
        title: "Preventive Maintenance",
        text: "Preventive maintenance programs help hospitals and imaging centers reduce unplanned downtime, protect image quality, and keep MRI, CT, and PET/CT systems ready for clinical schedules.",
    },
    {
        title: "Emergency Repair",
        text: "When a scanner is down, Advanced Imaging Services provides emergency imaging equipment repair support, troubleshooting, field-service coordination, and replacement-part sourcing to restore patient access as quickly as possible.",
    },
    {
        title: "System Tested Parts Support",
        text: "Our parts support helps buyers source tested MRI coils, CT tubes, boards, power supplies, detectors, and related medical imaging equipment parts with OEM, modality, system model, part number, and AIS item ID details.",
    },
];

const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
        },
    })),
};

export default function Services() {
    return(
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(servicesStructuredData) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessStructuredData) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbStructuredData) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
            />
            <Subheader
                title={['MRI, CT & PET/CT ', <span key="1">Service</span>]}
                extraClass="services_bg"
            />
            <section className={styles.introSection}>
                <div className="container">
                    <div className={styles.introPanel}>
                        <span>Nationwide Medical Imaging Equipment Support</span>
                        <h2>MRI, CT, PET/CT, and Tested Parts Support</h2>
                        <p>
                            Advanced Imaging Services provides MRI service, CT service, PET/CT service,
                            preventive maintenance, emergency repair, and system-tested medical imaging
                            parts support for hospitals, imaging centers, and service buyers across the
                            United States.
                        </p>
                        <p>
                            Our team helps maintain and repair medical imaging equipment, troubleshoot scanner
                            downtime, coordinate tested replacement parts, and support major OEM systems including
                            GE, Siemens, Toshiba/Canon, and other platforms where appropriate.
                        </p>
                    </div>
                </div>
            </section>
            <ExpertMriServices/>
            <CtServices/>
            <section className={styles.capabilitiesSection}>
                <div className="container">
                    <h2>Medical Imaging Equipment <span>Service Capabilities</span></h2>
                    <div className={styles.capabilityGrid}>
                        {serviceSupportSections.map((item) => (
                            <article
                                key={item.title}
                                id={item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}
                                className={styles.capabilityItem}
                            >
                                <h3>{item.title}</h3>
                                <p>{item.text}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>
            <section className={styles.serviceIndexSection}>
                <div className="container">
                    <div className={styles.indexHeading}>
                        <span>Choose a service path</span>
                        <h2>Service <span>Coverage Directory</span></h2>
                        <p>
                            Start with MRI, CT, or PET/CT, then choose a general service page or an
                            OEM-specific path for GE, Siemens, or Toshiba/Canon support.
                        </p>
                    </div>
                    <div className={styles.modalityDirectory}>
                        {directoryModalities.map(([modality, config]) => {
                            const servicePage = primaryServiceLinks.find((page) => page.modality === modality);
                            const serviceBrandPages = brandServiceLinks.filter((page) => page.modality === modality);

                            return (
                                <details key={modality} className={styles.modalityPanel}>
                                    <summary>
                                        <span>{config.label}</span>
                                        <strong>{config.serviceLabel} and OEM support</strong>
                                    </summary>
                                    <div className={styles.directoryColumns}>
                                        <section>
                                            <h3>{config.label} Service</h3>
                                            {servicePage && (
                                                <Link href={`/services/${servicePage.slug}`}>
                                                    All {servicePage.shortTitle}
                                                </Link>
                                            )}
                                            {serviceBrandPages.map((page) => (
                                                <Link key={page.slug} href={`/services/${page.slug}`}>
                                                    {page.shortTitle}
                                                </Link>
                                            ))}
                                        </section>
                                    </div>
                                </details>
                            );
                        })}
                    </div>
                </div>
            </section>
            <section className={styles.faqSection}>
                <div className="container">
                    <h2>Medical Imaging Service FAQ</h2>
                    <div className={styles.faqList}>
                        {faqItems.map((item) => (
                            <article key={item.question} className={styles.faqItem}>
                                <h3>{item.question}</h3>
                                <p>{item.answer}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>
        </>
    )
}
