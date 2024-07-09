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

export default function Home() {
  return (
    <>
      <BannerTwo/>
      <HomeCard/>
      <About/>
      <BuySearch/>
      <Services/>
      <PartCard mainTitle={["Most Requested ", <span key="1">Parts</span>]}/>
      <GetInTouch/>
      <PartCard mainTitle={["CT Tubes ", <span key="2">Available</span>]}/>
      <ExpertsProvidingService/>
      <OurFocus/>
      <Testimonial/>
    </>
  );
}
