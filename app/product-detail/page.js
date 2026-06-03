"use client"

import Subheader from "@/components/subheader/Subheader";
import Product from "./product/Product";
import FoundYourPart from "./found-your-part/FoundYourPart";
import RelatedProducts from "./related-products/RelatedProducts";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { buildProductHref, slugify } from '@/app/data/seoProducts';

export default function ProductDetail() {
  const [storedProduct, setStoredProduct] = useState([]);
  const router = useRouter();


  useEffect(() => {
    const rawQuery = window.location.search.replace(/^\?/, "");
    if (rawQuery) {
      const decoded = decodeURIComponent(rawQuery);
      const slug = slugify(decoded);
      if (slug) {
        router.replace(`/products/${slug}`);
        return;
      }
    }

    let stored = null;
    try {
      stored = JSON.parse(localStorage.getItem('product'));
    } catch {
      stored = null;
    }
    if (stored?.id) {
      const href = buildProductHref(stored);
      if (href) {
        router.replace(href);
        return;
      }
    }

    setStoredProduct(stored);
  }, [router]);

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
