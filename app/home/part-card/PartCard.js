"use client"
import { useEffect, useState } from "react"
import styles from "./partCard.module.scss"
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import Link from 'next/link';
import { fetchProducts } from "@/components/fetchProducts/fetchedProducts";
import { getPrimaryImagePath, ImageComponent } from '@/components/fetchImages/Image';
import { buildProductHref } from "@/app/data/seoProducts";



export default function PartCard({ mainTitle }) {

    const [products, setProducts] = useState([]);

    useEffect(() => {
        const controller = new AbortController();
        let active = true;

        const fetchData = async () => {

            try {
                const isCtSection = String(mainTitle?.[0] || '').includes('CT');
                const data = await fetchProducts({
                    modality: isCtSection ? 'CT' : '',
                    limit: 12,
                    signal: controller.signal,
                });
                if (active) setProducts(data);
            } catch (error) {
                console.error("Error fetching products:", error);
            }
        };
        fetchData();

        return () => {
            active = false;
            controller.abort();
        };
    }, [mainTitle]);
    
    return(
        <>
            <div className={`part_wrapper ${styles.part_wrapper}`}>
                <div className="container">
                    <h2 className="main-title">{mainTitle}</h2>
                    <div className={styles.part_list_wrap}>
                    <Swiper
                        slidesPerView={3}
                        spaceBetween={55}
                        navigation={true}
                        autoplay={{
                            delay: 2500,
                            disableOnInteraction: false,
                          }}
                        breakpoints={{
                            300: {
                              slidesPerView: 1,
                              spaceBetween: 20,
                            },
                            768: {
                              slidesPerView: 2,
                              spaceBetween: 40,
                            },
                            1024: {
                              slidesPerView: 3,
                              spaceBetween: 50,
                            },
                          }}
                        modules={[Autoplay, Navigation]}
                        className="mySwiper"
                        >
                        {
                            products.map((product)=>{
                                const { id, Name } = product;
                                return(
                                    <SwiperSlide key={id} className="flex items-center">
                                        <Link
                                            href={buildProductHref({ id, Name }) || "/product-detail"}
                                            onClick={() => {
                                                try {
                                                    localStorage.setItem(
                                                        "product",
                                                        JSON.stringify({ id, Name })
                                                    );
                                                } catch {
                                                    // ignore storage errors
                                                }
                                            }}
                                        >
                                            <figure>
                                                <ImageComponent
                                                    imagePath={getPrimaryImagePath(product)}
                                                    alt={`${Name || "Medical imaging part"} ${id || ""}`}
                                                />
                                                <h3>{Name}</h3>
                                            </figure>
                                        </Link>
                                    </SwiperSlide>
                                )
                            })
                        }
                    </Swiper>
                    </div>
                </div>
            </div>
        </>
    )
}
