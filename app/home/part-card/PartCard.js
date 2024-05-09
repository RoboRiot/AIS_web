"use client"
import React, { createContext } from 'react';
import Image from "next/image"
import styles from "./partCard.module.scss"
import partCardList from "./partCardList.json"
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Navigation } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import Link from 'next/link';

export default function PartCard(prop) {
    
    return(
        <>
            <div className={`part_wrapper ${styles.part_wrapper}`}>
                <div className="container">
                    <h2 className="main-title">{prop.mainTitle}</h2>
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
                            partCardList.map(({partImage,partTitle},index)=>{
                                return(
                                    <SwiperSlide key={`part-${index}`} className="flex items-center">
                                        <Link href="/product-detail">
                                            <figure>
                                                <Image src={partImage} width={380} height={200} alt="image" />
                                                <h3>{partTitle}</h3>
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