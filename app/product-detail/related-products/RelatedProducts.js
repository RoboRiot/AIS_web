"use client"
import { useEffect, useState } from "react"
import Image from "next/image"
import styles from "./relatedProducts.module.scss"
import pro1 from "@/public/assets/images/slide1.png"
import pro2 from "@/public/assets/images/slide2.png"
import pro3 from "@/public/assets/images/slide3.png"
import Link from "next/link"
import AOS from 'aos';
import 'aos/dist/aos.css';
import { fetchProducts } from "@/components/fetchProducts/fetchedProducts";
import { ImageComponent } from '@/components/fetchImages/Image';


export default function RelatedProducts() {
    const [products, setProducts] = useState([]);
    const [storedProduct, setStoredProduct] = useState([]);
    const [imageUrl, setImageUrl] = useState(null);


    useEffect(() => {
        setStoredProduct(JSON.parse(localStorage.getItem('product')));

        const fetchData = async () => {

            try {
                const data = await fetchProducts();
                const matchedProducts = data.filter((product) => (product.OEM === JSON.parse(localStorage.getItem('product')).OEM))
                const slicedProductsArray = matchedProducts.slice(0, 3);
                setProducts(slicedProductsArray);
            } catch (error) {
                console.error("Error fetching products:", error);
            }
        };
        fetchData();

    }, []);

    useEffect(() => {
        AOS.init();
    }, []);
    return (
        <>
            <div className={styles.related_products}>
                <div className="container">
                    <h2 className="main-title">Related <span>products</span></h2>
                    <ul className="list-none flex flex-wrap" data-aos="fade-up" data-aos-duration="1000">
                        {products.map((x, index) =>
                            <li key={index}>
                            {/* {getImageUrl(x.id)} */}

                                <Link href="/product-detail">
                                    <figure>
                                        {/* <Image src={imageUrl  ? imageUrl : pro1 } alt="pro1" /> */}
                                        <ImageComponent imagePath={`Parts/${x.id}/${x.id}`} />
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