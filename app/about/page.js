import Subheader from "@/components/subheader/Subheader";
import MriExperts from "./mri_experts/MriExperts";
import HowWeAre from "./how_we_are/HowWeAre";
import WhatWeDev from "./what_we_dev/WhatWeDev";
import Expansion from "./expansion/Expansion";
import { DEFAULT_SOCIAL_IMAGES } from "@/app/data/siteMetadata";

export const metadata = {
  title: "About Advanced Imaging Services | Medical Imaging Support",
  description:
    "Learn about Advanced Imaging Services, our medical imaging expertise, and our nationwide MRI, CT, PET/CT parts, repair, and support capabilities.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About Advanced Imaging Services",
    description:
      "Meet the team supporting MRI, CT, and PET/CT equipment, replacement parts, and imaging facilities nationwide.",
    url: "/about",
    type: "website",
    images: DEFAULT_SOCIAL_IMAGES,
  },
  twitter: {
    card: "summary_large_image",
    title: "About Advanced Imaging Services",
    description:
      "Medical imaging equipment service, replacement parts, and nationwide support.",
    images: DEFAULT_SOCIAL_IMAGES,
  },
};

export default function About() {
  return (
    <>
      <Subheader
        title={['About ', <span key="1">Us</span>]}
        extraClass="about_bg"
      />
      <MriExperts/>
      <HowWeAre/>
      <WhatWeDev/>
      <Expansion/>
    </>
  );
}
