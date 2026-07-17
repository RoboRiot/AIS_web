import { BASE_URL } from "@/app/data/seoProducts";

export const metadata = {
  title: "Medical Imaging Parts Inventory | Advanced Imaging Services",
  description:
    "Search tested MRI, CT, PET/CT, mobile imaging, OEM replacement parts, part numbers, AIS item IDs, and medical imaging equipment components from Advanced Imaging Services.",
  alternates: {
    canonical: `${BASE_URL}/parts`,
  },
  openGraph: {
    title: "Medical Imaging Parts Inventory | Advanced Imaging Services",
    description:
      "Search tested MRI, CT, PET/CT, OEM replacement parts, part numbers, and medical imaging equipment components.",
    url: `${BASE_URL}/parts`,
    type: "website",
  },
};

export default function PartsLayout({ children }) {
  return children;
}
