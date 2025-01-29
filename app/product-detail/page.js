"use client"

import Subheader from "@/components/subheader/Subheader";
import Product from "./product/Product";
import FoundYourPart from "./found-your-part/FoundYourPart";
import RelatedProducts from "./related-products/RelatedProducts";
import { useEffect, useState } from 'react';

export default function ProductDetail() {
  const [storedProduct, setStoredProduct] = useState([]);


  useEffect(() => {
    setStoredProduct(JSON.parse(localStorage.getItem('product')));
  }, []);

  return (
    <>
      <Subheader
        title={['SFP Receiver and AntennaAssembly']}
        extraClass="product_bg"
      />
      <Product clickedProduct={storedProduct}/>
      <FoundYourPart/>
      <RelatedProducts/>
    </>
  );
}
