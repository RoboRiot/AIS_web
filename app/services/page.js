import Subheader from "@/components/subheader/Subheader";
import ExpertMriServices from "./expert-mri-services/ExpertMriServices";
import MobileMri from "./mobile-mri/MobileMri";
import CtServices from "./ct-services/CtServices";
import Link from "next/link";
import styles from "./servicesSeo.module.scss";
import { BASE_URL } from "@/app/data/seoProducts";

export const metadata = {
    title: "Mobile MRI Trailer Rental, CT & PET/CT Services | Advanced Imaging",
    description:
        "Mobile MRI trailer rental, mobile CT scanner rental, PET/CT trailer support, and 24/7 service for GE, Philips, Siemens, Canon, and Toshiba imaging systems.",
    keywords: [
        "mobile medical trailer",
        "mobile diagnostic imaging rentals",
        "mobile imaging equipment rental",
        "mobile MRI rental",
        "mobile MRI trailer",
        "mobile MRI trailer rental",
        "mobile MRI scanner rental",
        "mobile CT trailer",
        "mobile CT scanner rental",
        "temporary CT scanner rental",
        "mobile PET CT trailer",
        "PET CT mobile units",
        "MRI trailer rental",
        "CT trailer rental",
        "interim mobile imaging",
        "short term mobile MRI lease",
        "long term mobile imaging trailer lease",
        "mobile imaging trailer",
        "GE mobile MRI",
        "Philips mobile MRI",
        "Siemens mobile MRI",
        "mobile MRI service",
        "mobile CT service",
    ],
    alternates: {
        canonical: "/services",
    },
    openGraph: {
        title: "Mobile MRI Trailer Rental, CT & PET/CT Services | Advanced Imaging",
        description:
            "Mobile MRI and CT trailer rentals, PET/CT support, fleet maintenance, and rapid-response service for major imaging platforms.",
        url: "/services",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "Mobile MRI Trailer Rental, CT & PET/CT Services | Advanced Imaging",
        description:
            "24/7 mobile imaging trailer support for MRI, CT, PET/CT, and major OEM platforms.",
    },
};

const servicesStructuredData = {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${BASE_URL}/services#mobile-imaging-services`,
    url: `${BASE_URL}/services`,
    serviceType: "Mobile MRI, CT, and PET/CT trailer rental and service",
    name: "Advanced Imaging Mobile Imaging Services",
    description:
        "Mobile MRI trailer rental, mobile CT scanner rental, PET/CT trailer support, and emergency imaging service for hospitals and imaging centers.",
    provider: {
        "@type": "Organization",
        name: "Advanced Imaging",
        url: BASE_URL,
    },
    areaServed: {
        "@type": "Country",
        name: "United States",
    },
    hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Mobile Imaging Service Catalog",
        itemListElement: [
            {
                "@type": "Offer",
                itemOffered: {
                    "@type": "Service",
                    name: "Mobile MRI trailer rental and lease support",
                },
            },
            {
                "@type": "Offer",
                itemOffered: {
                    "@type": "Service",
                    name: "Mobile CT scanner and trailer rental support",
                },
            },
            {
                "@type": "Offer",
                itemOffered: {
                    "@type": "Service",
                    name: "Mobile PET/CT trailer support",
                },
            },
            {
                "@type": "Offer",
                itemOffered: {
                    "@type": "Service",
                    name: "Interim mobile imaging coverage for downtime, renovations, and overflow",
                },
            },
        ],
    },
    additionalType: [
        "GE mobile MRI service",
        "Philips mobile MRI service",
        "Siemens mobile MRI service",
    ],
};

const faqItems = [
    {
        question: "Do you provide mobile MRI trailer rental for GE, Philips, and Siemens systems?",
        answer:
            "Yes. We support mobile MRI trailer rental and service workflows across major OEM platforms, including GE, Philips, and Siemens systems.",
    },
    {
        question: "When do hospitals use mobile MRI or mobile CT scanner rentals?",
        answer:
            "Facilities commonly use mobile imaging rentals during equipment failure, planned renovations, scanner upgrades, seasonal volume increases, rural access programs, and new service-line launches.",
    },
    {
        question: "Do you service mobile CT trailers and mobile PET CT trailers?",
        answer:
            "Yes. Our team supports mobile CT trailer and mobile PET CT trailer operations with maintenance, troubleshooting, and rapid-response service.",
    },
    {
        question: "Can you help with emergency downtime on mobile imaging trailers?",
        answer:
            "Yes. We offer 24/7 support designed to reduce downtime and restore clinical operations as quickly as possible.",
    },
    {
        question: "Do you offer both short-term and long-term trailer support?",
        answer:
            "Yes. We work with facilities on flexible rental and service plans, from temporary coverage to long-term mobile imaging programs.",
    },
    {
        question: "Do you support MRI trailer cost planning and replacement decisions?",
        answer:
            "Yes. We help teams evaluate mobile MRI trailer cost factors, service needs, and transition planning for replacement or expansion.",
    },
];

const searchIntentItems = [
    {
        title: "Mobile MRI Trailer Rental",
        description:
            "Short-term and long-term MRI trailer rental support for equipment downtime, construction projects, service-line expansion, and patient-volume overflow.",
    },
    {
        title: "Mobile CT Scanner Rental",
        description:
            "Temporary CT scanner trailer planning and service coordination for hospitals, imaging centers, emergency coverage, and rotating sites.",
    },
    {
        title: "Mobile PET/CT Trailer Support",
        description:
            "Operational and technical support for PET/CT mobile units, including service planning for oncology imaging continuity.",
    },
    {
        title: "GE, Philips & Siemens Mobile MRI",
        description:
            "OEM-aware support for GE mobile MRI, Philips mobile MRI, and Siemens mobile MRI environments, plus related fleet and uptime needs.",
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
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
            />
            <Subheader
                title={['Our ', <span key="1">Services</span>]}
                extraClass="services_bg"
            />
            <MobileMri/>
            <ExpertMriServices/>
            <CtServices/>
            <section className={styles.intentSection}>
                <div className="container">
                    <h2>Mobile Medical Trailer Rental Support</h2>
                    <p>
                        Facilities searching for mobile diagnostic imaging rentals often need coverage for scanner downtime,
                        renovations, overflow volume, rural access, or new program launches. Advanced Imaging supports those
                        workflows with mobile MRI, mobile CT, PET/CT trailer, and major OEM service expertise.
                    </p>
                    <div className={styles.intentGrid}>
                        {searchIntentItems.map((item) => (
                            <article key={item.title} className={styles.intentItem}>
                                <h3>{item.title}</h3>
                                <p>{item.description}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>
            <section className={styles.oemLinksSection}>
                <div className="container">
                    <h2>Specialized Mobile Imaging Pages</h2>
                    <p>
                        Explore dedicated pages for the highest-intent mobile imaging trailer searches.
                    </p>
                    <div className={styles.cardGrid}>
                        <Link href="/services/mobile-mri-trailer-rental" className={styles.cardLink}>
                            <h3>Mobile MRI Trailer Rental</h3>
                            <p>MRI trailer rental, lease planning, downtime coverage, and mobile MRI service support.</p>
                        </Link>
                        <Link href="/services/ge-mobile-mri" className={styles.cardLink}>
                            <h3>GE Mobile MRI Service</h3>
                            <p>Service coverage, uptime support, and field response for GE mobile MRI systems.</p>
                        </Link>
                        <Link href="/services/philips-mobile-mri" className={styles.cardLink}>
                            <h3>Philips Mobile MRI Service</h3>
                            <p>Maintenance and repair support for Philips mobile MRI trailers and imaging workflows.</p>
                        </Link>
                        <Link href="/services/siemens-mobile-mri" className={styles.cardLink}>
                            <h3>Siemens Mobile MRI Service</h3>
                            <p>Rapid-response service and technical support for Siemens mobile MRI environments.</p>
                        </Link>
                        <Link href="/services/mobile-ct-trailer-rental" className={styles.cardLink}>
                            <h3>Mobile CT Trailer Rental</h3>
                            <p>CT trailer rental and service support for high-availability imaging operations.</p>
                        </Link>
                        <Link href="/services/mobile-pet-ct-trailer" className={styles.cardLink}>
                            <h3>Mobile PET/CT Trailer Service</h3>
                            <p>Operational and technical support for mobile PET/CT trailer programs.</p>
                        </Link>
                    </div>
                </div>
            </section>
            <section className={styles.faqSection}>
                <div className="container">
                    <h2>Mobile Imaging Services FAQ</h2>
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
