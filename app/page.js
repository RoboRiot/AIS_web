import About from "./home/about/About";
import BuySearch from "./home/buy-search/BuySearch";
import GetInTouch from "./home/get-in-touch/GetInTouch";
import HomeCard from "./home/home-card/HomeCard";
import PartCard from "./home/part-card/PartCard";
import Services from "./home/services/Services";
import ExpertsProvidingService from "./home/experts-providing-service/ExpertsProvidingService";
import OurFocus from "./home/our-focus/OurFocus";
import Testimonial from "./home/testimonial/Testimonial";
import BannerTwo from "./home-2/banner/BannerTwo";
import { fetchHomepageProducts } from "@/app/data/serverFirestoreProducts";
import { DEFAULT_SOCIAL_IMAGES } from "@/app/data/siteMetadata";

export const revalidate = 900;

export const metadata = {
  title: "MRI, CT & PET/CT Parts, Service & Trailers | AIS",
  description:
    "Nationwide MRI, CT, and PET/CT parts, repair, preventive maintenance, remote support, and mobile imaging trailer rentals from Advanced Imaging Services.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "MRI, CT & PET/CT Parts, Service & Mobile Trailers",
    description:
      "Nationwide medical imaging parts, equipment service, repair, and mobile trailer rental support.",
    url: "/",
    type: "website",
    images: DEFAULT_SOCIAL_IMAGES,
  },
  twitter: {
    card: "summary_large_image",
    title: "MRI, CT & PET/CT Parts, Service & Mobile Trailers",
    description:
      "Nationwide medical imaging parts, equipment service, repair, and mobile trailer rental support.",
    images: DEFAULT_SOCIAL_IMAGES,
  },
};

export default async function Home() {
  let homepageProducts = { mostRequested: [], ctTubes: [] };
  try {
    homepageProducts = await fetchHomepageProducts();
  } catch (error) {
    console.error("Unable to render homepage products:", error);
  }

  return (
    <>
      <BannerTwo/>
      <HomeCard/>
      <About/>
      <BuySearch/>
      <Services/>
      <PartCard
        mainTitle={["Most Requested ", <span key="1">Parts</span>]}
        initialProducts={homepageProducts.mostRequested}
      />
      <GetInTouch/>
      <PartCard
        mainTitle={["CT Tubes ", <span key="2">Available</span>]}
        initialProducts={homepageProducts.ctTubes}
        modality="CT"
      />
      <ExpertsProvidingService/>
      <OurFocus/>
      <Testimonial/>
    </>
  );
}
