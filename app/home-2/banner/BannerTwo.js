"use client"
import React from 'react';
import styles from "./banner.module.scss"
import Link from "next/link"
import Image from "next/image";
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, EffectFade, Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'swiper/css/effect-fade';
import bannerImageFour from "@/public/assets/images/bannerslider4.jpg";
import bannerImageFive from "@/public/assets/images/bannerslider5.jpg";
import bannerImageSix from "@/public/assets/images/bannerslider6.jpg";

const bannerImageList = [bannerImageFour, bannerImageFive, bannerImageSix];

export default function BannerTwo() {
    const [activeIndex, setActiveIndex] = React.useState(0);

    return(
        <>
            <div className={`banner_main_wrapper flex items-center ${styles.banner_main_wrapper}`}>
                <div className={styles.banner_sider}>
                    <Swiper
                        slidesPerView={1}
                        spaceBetween={0}
                        effect={'fade'}
                        speed={2200}
                        loop={true}
                        fadeEffect={{
                            crossFade: true,
                        }}
                        navigation={false}
                        pagination={{
                            clickable: true,
                        }}
                        autoplay={{
                            delay: 7600,
                            disableOnInteraction: false,
                            pauseOnMouseEnter: true,
                        }}
                        onSlideChange={(swiper) => setActiveIndex(swiper.realIndex)}
                        modules={[EffectFade, Autoplay, Pagination, Navigation]}
                        className="mySwiper"
                        >
                        {
                            bannerImageList.map((image,index)=>{
                                return(
                                    <SwiperSlide key={`banner-${index}`} style={{ position: "relative", width: '100%', height: '100%' }} className="flex items-center">
                                        {index === activeIndex && (
                                            <Image
                                                src={image}
                                                alt=""
                                                aria-hidden="true"
                                                fill
                                                priority={index === 0}
                                                quality={82}
                                                sizes="100vw"
                                                style={{ objectFit: "cover" }}
                                            />
                                        )}
                                    </SwiperSlide>
                                )
                            })
                        }
                    </Swiper>
                </div>
                <div className={styles.banner_two_slider}>
                    <div className="container flex">
                        <section>
                            <small>Welcome to</small>
                            <h1>Advanced <span>Imaging</span></h1>
                            <p>We provide parts, accessories, repairs, and <br/>maintenance for the world&apos;s leading CT and <br/>MRI scanning equipment. </p>
                            <Link href="/contact" className="simple-btn">Contact Us</Link>
                        </section>
                    </div>
                </div>
            </div>
        </>
    )
}
