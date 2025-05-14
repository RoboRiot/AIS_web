"use client"
import React from 'react';
import Image from "next/image"
import styles from "./testimonial.module.scss"
import testimonialList from "./testimonialList.json"
import quoteImage from "@/public/assets/images/quote.svg"
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';

export default function Testimonial() {
    
    return(
        <>
            <div className={`part_wrapper testimonial_wrap ${styles.testimonial_wrap}`}>
                <div className="container">
                    <h2 className="main-title">What Our <span>Clients says</span></h2>
                    <div className={styles.testimonial_slide}>
                    <Swiper
                        slidesPerView={2}
                        spaceBetween={50}
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
                              slidesPerView: 2,
                              spaceBetween: 50,
                            },
                        }}
                        modules={[Autoplay, Navigation]}
                        className="mySwiper"
                        >
                        {
                            testimonialList.map(({comment,title,address},index)=>{
                                return(
                                    <SwiperSlide key={`part-${index}`} className="flex items-center">
                                        <section>
                                            <Image src={quoteImage} alt="quoteImage" />
                                            <p>{comment}</p>
                                            <span><b>{title}</b> {address}</span>
                                        </section>
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