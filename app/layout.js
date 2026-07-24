import Header from '@/components/header/Header';
import Footer from '@/components/footer/Footer';
import '@/styles/globals.scss'
import "aos/dist/aos.css";
import { Geologica } from "next/font/google";
import Script from "next/script";
import { BASE_URL } from "@/app/data/seoProducts";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";
import WebsiteAnalytics from "@/components/analytics/WebsiteAnalytics";
import AosInitializer from "@/components/animations/AosInitializer";

const siteName = "Advanced Imaging Services";
const geologica = Geologica({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-geologica",
  weight: "variable",
  adjustFontFallback: false,
});

export const metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Advanced Imaging Services | MRI, CT & PET/CT Service and Parts",
    template: "%s",
  },
  description: "Advanced Imaging Services provides MRI, CT, PET/CT, mobile imaging equipment service, repair, preventive maintenance, emergency support, and tested medical imaging parts across the United States.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName,
    title: "Advanced Imaging Services | MRI, CT & PET/CT Service and Parts",
    description: "MRI, CT, PET/CT, mobile imaging equipment service, repair, preventive maintenance, emergency support, and tested medical imaging parts.",
    url: BASE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "Advanced Imaging Services | MRI, CT & PET/CT Service and Parts",
    description: "Nationwide medical imaging equipment service, repair, mobile imaging support, and tested replacement parts.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${BASE_URL}/#organization`,
  name: siteName,
  alternateName: "Advanced Imaging Parts",
  url: BASE_URL,
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
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+1-800-200-3583",
    contactType: "sales and service",
    areaServed: "US",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={geologica.variable}>
      <body>
        <GoogleAnalytics />
        <WebsiteAnalytics />
        <AosInitializer />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <div className='body-wrapper'>
          <Header />
          <main>
            {children}
          </main>
          <Footer />
        </div>
        <Script
          id="hs-script-loader"
          src="https://js-na2.hs-scripts.com/242600993.js"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
