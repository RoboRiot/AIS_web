"use client"
import React from 'react';
import styles from "./banner.module.scss"
import Link from "next/link"
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, EffectFade, Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'swiper/css/effect-fade';
import bannerImageList from "./bannerImageList.json"

export default function BannerTwo() {
    React.useEffect(() => {
        bannerImageList.forEach(({ image }) => {
            const preloadImage = new window.Image();
            preloadImage.src = image;
        });
    }, []);

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
                        modules={[EffectFade, Autoplay, Pagination, Navigation]}
                        className="mySwiper"
                        >
                        {
                            bannerImageList.map(({image},index)=>{
                                return(
                                    <SwiperSlide key={`banner-${index}`} style={{ backgroundImage: `url(${image})`, width: '100%', height: '100%' }} className="flex items-center">
                                        {/* <Image width={1920} height={1080} src={image} alt="image" /> */}
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
