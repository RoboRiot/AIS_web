import { DEFAULT_SOCIAL_IMAGES } from "@/app/data/siteMetadata";

export const metadata = {
  title: "Contact Advanced Imaging Services | Parts, Service & Trailers",
  description:
    "Contact Advanced Imaging Services for MRI, CT, and PET/CT parts, equipment service, emergency support, or mobile imaging trailer availability.",
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: "Contact Advanced Imaging Services",
    description:
      "Request medical imaging parts, equipment service, emergency support, or mobile trailer availability.",
    url: "/contact",
    type: "website",
    images: DEFAULT_SOCIAL_IMAGES,
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact Advanced Imaging Services",
    description:
      "Request MRI, CT, or PET/CT parts, service, and mobile trailer support.",
    images: DEFAULT_SOCIAL_IMAGES,
  },
};

export default function ContactLayout({ children }) {
  return children;
}
