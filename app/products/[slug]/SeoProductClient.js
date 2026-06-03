"use client";

import { useEffect, useState } from "react";
import Product from "@/app/product-detail/product/Product";
import RelatedProducts from "@/app/product-detail/related-products/RelatedProducts";

export default function SeoProductClient({ initialProduct }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!initialProduct) return;
    try {
      localStorage.setItem("product", JSON.stringify(initialProduct));
    } catch {
      // ignore storage errors
    }
    document.documentElement.dataset.seoProductLoaded = "true";
    setReady(true);
  }, [initialProduct]);

  if (!ready) return null;

  return (
    <>
      <Product clickedProduct={initialProduct} />
      <RelatedProducts />
    </>
  );
}
