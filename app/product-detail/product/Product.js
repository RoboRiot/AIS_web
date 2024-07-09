"use client"
import React, { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import styles from "./product.module.scss"
import { FreeMode, Navigation, Thumbs } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/free-mode';
import 'swiper/css/navigation';
import 'swiper/css/thumbs';
import Image from 'next/image';
import Image1 from "@/public/assets/images/experts.jpg"
import stockImage from "@/public/assets/images/stock.svg"
import Link from 'next/link';
import RequestModal from '@/components/modals/RequestModal';
import AOS from 'aos';
import 'aos/dist/aos.css';

export default function Product() {
    const [thumbsSwiper, setThumbsSwiper] = useState(null);
    const [showPop, setShowPop] = useState(false);

    useEffect(() => {
        if (showPop) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
    }, [showPop]);

    const clickModal =()=>{
        setShowPop(!showPop);
    }

    useEffect(() => {
        AOS.init();
    },[]);

    return(
        <>
            <div className={styles.product_details}>
                <div className="container flex">
                    <div className={`flex ${styles.product_slider}`} data-aos="fade-right" data-aos-duration="1000">
                        <Swiper
                            onSwiper={setThumbsSwiper}
                            spaceBetween={0}
                            slidesPerView={3}
                            freeMode={true}
                            watchSlidesProgress={true}
                            direction="vertical"
                            modules={[FreeMode, Navigation, Thumbs]}
                            className="mySwiperthumb"
                        >
                            <SwiperSlide>
                            <Image width={114} height={76} alt="image" src={Image1} />
                            </SwiperSlide>
                            <SwiperSlide>
                            <Image width={114} height={76} alt="image" src={Image1} />
                            </SwiperSlide>
                            <SwiperSlide>
                            <Image width={114} height={76} alt="image" src={Image1} />
                            </SwiperSlide>
                            <SwiperSlide>
                            <Image width={114} height={76} alt="image" src={Image1} />
                            </SwiperSlide>
                        </Swiper>
                        <Swiper
                            spaceBetween={10}
                            navigation={true}
                            thumbs={{ swiper: thumbsSwiper }}
                            modules={[FreeMode, Navigation, Thumbs]}
                            className="mySwiper2"
                        >
                            <SwiperSlide>
                            <Image width={470} height={313} alt="image" src={Image1} />
                            </SwiperSlide>
                            <SwiperSlide>
                            <Image width={470} height={313} alt="image" src={Image1} />
                            </SwiperSlide>
                            <SwiperSlide>
                            <Image width={470} height={313} alt="image" src={Image1} />
                            </SwiperSlide>
                            <SwiperSlide>
                            <Image width={470} height={313} alt="image" src={Image1} />
                            </SwiperSlide>
                        </Swiper>
                    </div>
                    <div className={styles.detail_content} data-aos="fade-left" data-aos-duration="1000">
                        <h2>10Gig SFP Receiver and Antenna Assembly 5311645-2</h2>
                        <span>SKU: 09ae5c15d4cb</span>
                        <span>Categories: CT Scanner, GE</span>
                        <Image src={stockImage} alt="stockImage"/>
                        <h3>Description</h3>
                        <p>
                            Description: 10Gig SFP Receiver and Antenna Assembly
                            <br/>
                            Part Number: 5311645-2
                            <br/>
                            System Model: Lightspeed
                            <br/>
                            System Manufacturer: GE
                            <br/>
                            Category: CT Scanner
                        </p>
                        <p>Call for Pricing: <Link href="tel:(800) 200-3583">(800) 200-3583</Link></p>
                        <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc et metus rutrum, gravida metus eget, sodales eros. Mauris elementum dolor ut enim viverra, at dictum felis ultrices. Nam lacinia lacinia congue. Phasellus pretium, ex ac viverra posuere, tortor lectus tincidunt nunc, vitae accumsan felis justo at nulla. Nulla congue felis risus. Vestibulum tincidunt justo a ex aliquam viverra.</p>
                        <button className='simple-btn' onClick={()=>clickModal()}>Request</button>
                    </div>
                </div>
            </div>
            {showPop && <RequestModal closeModal={() => setShowPop(false)}/>}
        </>
    )
}