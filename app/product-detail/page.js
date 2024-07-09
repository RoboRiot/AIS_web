import Subheader from "@/components/subheader/Subheader";
import Product from "./product/Product";
import FoundYourPart from "./found-your-part/FoundYourPart";
import RelatedProducts from "./related-products/RelatedProducts";

export default function ProductDetail() {
  return (
    <>
      <Subheader
        title={['SFP Receiver and AntennaAssembly']}
        extraClass="product_bg"
      />
      <Product/>
      <FoundYourPart/>
      <RelatedProducts/>
    </>
  );
}
