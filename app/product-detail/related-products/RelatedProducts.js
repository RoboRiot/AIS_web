"use client"
import { useEffect, useState } from "react"
import styles from "./relatedProducts.module.scss"
import Link from "next/link"
import { fetchProducts } from "@/components/fetchProducts/fetchedProducts";
import { getPrimaryImagePath, ImageComponent } from '@/components/fetchImages/Image';
import { buildProductHref } from "@/app/data/seoProducts";


export default function RelatedProducts() {
    const [products, setProducts] = useState([]);


    useEffect(() => {
        const stored = (() => {
            try {
                return JSON.parse(localStorage.getItem('product'));
            } catch {
                return null;
            }
        })();
        const controller = new AbortController();
        let active = true;

        const fetchData = async () => {

            try {
                const targetOEM = stored?.OEM;
                const data = targetOEM
                    ? await fetchProducts({ oem: targetOEM, limit: 4, signal: controller.signal })
                    : [];
                if (active) {
                    setProducts(data.filter((product) => product.id !== stored?.id).slice(0, 3));
                }
            } catch (error) {
                console.error("Error fetching products:", error);
            }
        };
        fetchData();

        return () => {
            active = false;
            controller.abort();
        };
    }, []);

    return (
        <>
            <div className={styles.related_products}>
                <div className="container">
                    <h2 className="main-title">Related <span>products</span></h2>
                    <ul className="list-none flex flex-wrap" data-aos="fade-up" data-aos-duration="1000">
                        {products.map((x) =>
                            <li key={x.id}>
                                <Link
                                    href={buildProductHref(x) || "/product-detail"}
                                    onClick={() => {
                                        try {
                                            localStorage.setItem("product", JSON.stringify(x));
                                        } catch {
                                            // ignore storage errors
                                        }
                                    }}
                                >
                                    <figure>
                                        <ImageComponent
                                            imagePath={getPrimaryImagePath(x)}
                                            alt={`${x.Name || "Medical imaging part"} ${x.id || ""}`}
                                        />
                                        <h3>{x.Name}</h3>
                                    </figure>
                                </Link>
                            </li>
                        )}
                    </ul>
                </div>
            </div>
        </>
    )
}
