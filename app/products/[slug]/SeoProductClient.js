"use client";

import { useEffect, useState } from "react";
import Product from "@/app/product-detail/product/Product";
import RelatedProducts from "@/app/product-detail/related-products/RelatedProducts";
import { trackWebsiteEvent } from "@/components/utils/analytics";

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
    trackWebsiteEvent("product_view", {
      product_id: String(initialProduct.id || ""),
      product_name: String(initialProduct.Name || "").slice(0, 120),
      oem: String(initialProduct.OEM || "").slice(0, 60),
      modality: String(initialProduct.Modality || "").slice(0, 40),
    });
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
