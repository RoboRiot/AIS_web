"use client"
import React, { useEffect, useState, useRef } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import styles from "./product.module.scss"
import { FreeMode, Navigation, Thumbs } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/free-mode';
import 'swiper/css/navigation';
import 'swiper/css/thumbs';
import Image from 'next/image';
import Image1 from "@/public/assets/images/loader2.png"
import Enlarge from "@/public/assets/images/enlarge.svg"
import stockImage from "@/public/assets/images/stock.svg"
import Link from 'next/link';
import RequestModal from '@/components/modals/RequestModal';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { getImageUrl } from '@/components/fetchImages/Image';
import LightGallery from 'lightgallery/react';
import lgThumbnail from 'lightgallery/plugins/thumbnail';
import lgZoom from 'lightgallery/plugins/zoom';
import 'lightgallery/scss/lightgallery.scss';
import 'lightgallery/scss/lg-zoom.scss';

export default function Product({ clickedProduct }) {
    const [thumbsSwiper, setThumbsSwiper] = useState(null);
    const [showPop, setShowPop] = useState(false);
    const [uniqueImages, setUniqueImages] = useState([]); // Array to store unique images URLs
    const imageType = ['.png', '.jpg', '.jpeg', 'JPEG', 'JPG'];

    const [enlargeImage, setEnlargedImage] = useState(Image1);

    const swiperRef = useRef(null);

    // Handle image click for enlarging the image
    const handleImageClick = (image) => {
        console.log("Image clicked for enlargement:", image);
        setEnlargedImage(image); // Set the enlarged image
    };

    // Handle slide change to get the current active image
    const handleSlideChange = (swiper) => {
        const currentSlideIndex = swiper.activeIndex;
        const currentImage = uniqueImages[currentSlideIndex];
        console.log("Active Image on slide change:", currentImage);
        setEnlargedImage(currentImage); // Set the enlarged image based on active slide
    };


    console.log(clickedProduct);

    // Fetch image URLs for the clicked product
    useEffect(() => {
        const processImageUrls = async () => {
            const images = [];

            for (const img of clickedProduct?.Images) {



                for (const x of imageType) {
                    const url = await getImageUrl(img.endsWith("g") ? `${img}` : `${img}${x}`);
                    console.log(`${clickedProduct?.Images[0]}${x}`, "uni", url, `Parts/${clickedProduct?.id}/${clickedProduct?.id}${x}`)

                    if (url && !images.includes(url)) {
                        images.push(url);
                    }
                }
            }
            console.log(images);

            setUniqueImages(images); // Set the unique images state with fetched URLs
        };

        if (clickedProduct?.id) {
            processImageUrls(); // Process image URLs only if the product has an ID
        }
    }, [clickedProduct]);

    useEffect(() => {
        if (showPop) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
    }, [showPop]);

    const clickModal = () => {
        setShowPop(!showPop);
    }

    useEffect(() => {
        AOS.init();
    }, []);

    const onInit = () => {
        console.log('lightGallery has been initialized');
    };

    const lgSettings = {
        onInit: onInit,
        speed: 500,
        plugins: [lgThumbnail, lgZoom],
        controls: false, // Disable navigation controls (arrows)
        counter: false, // Disable image counter
        download: false, // Disable download button
        zoomFromOrigin: true, // Zoom from original size
    };

    return (
        <>
            <div className={styles.product_details}>
                <div className="container flex">
                    <div className={`flex product_slider ${styles.product_slider}`} data-aos="fade-right" data-aos-duration="1000">
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
                            {/* Render the thumbnail images only if they are available */}
                            {uniqueImages.length > 0 ? (
                                uniqueImages.map((image, index) => (
                                    <SwiperSlide key={index}>
                                        <Image width={114} height={76} alt="image" src={image}
                                            onClick={() => handleImageClick(image)} // Set enlarge image when clicked

                                        />
                                    </SwiperSlide>
                                ))
                            ) : (
                                <SwiperSlide>
                                    <Image width={114} height={76} alt="loading" src={Image1} />
                                </SwiperSlide>
                            )}
                        </Swiper>

                        <Swiper
                            spaceBetween={10}
                            navigation={true}
                            thumbs={{ swiper: thumbsSwiper }}
                            modules={[FreeMode, Navigation, Thumbs]}
                            className="mySwiper2"
                            onSlideChange={handleSlideChange} // To track when slide changes
                            ref={swiperRef}
                        >
                            {/* Render the large images only if they are available */}
                            {uniqueImages.length > 0 ? (
                                uniqueImages.map((image, index) => (

                                    <SwiperSlide key={index}>
                                        <LightGallery {...lgSettings}>
                                            <Image width={470} height={313} alt="image" src={image}
                                                onClick={() => handleImageClick(image)} // Set enlarge image when clicked
                                            />
                                        </LightGallery>
                                    </SwiperSlide>

                                ))
                            ) : (
                                <SwiperSlide>
                                    <LightGallery {...lgSettings}>
                                        <Image width={470} height={313} alt="image" src={Image1} />
                                    </LightGallery>
                                </SwiperSlide>
                            )}
                        </Swiper>

                        {/* Enlarge image option */}
                        <LightGallery {...lgSettings}>
                            <a href={uniqueImages.length > 0 ? enlargeImage : Image1}>
                                <Image src={Enlarge} alt="Enlarge" />
                            </a>
                        </LightGallery>
                    </div>

                    <div className={styles.detail_content} data-aos="fade-left" data-aos-duration="1000">
                        <h2>{clickedProduct?.Name}</h2>
                        <span> <b>SKU:</b> {clickedProduct?.id}</span>
                        <span><b>Categories:</b>  <Link href={`/parts?clickedOEM=${clickedProduct.OEM}`}>  {clickedProduct?.OEM} </Link>,  <Link href={`/parts?OEM=${clickedProduct.OEM}?clickedModality=${clickedProduct.Modality}`}> {clickedProduct?.Modality} </Link> </span>
                        <Image src={stockImage} alt="stockImage" />
                        <h3>Description</h3>
                        <ul className='list-none' style={{marginBottom: "20px"}}>
                            <li><b>Part Number: </b> {clickedProduct?.PN}</li>
                            <li>{clickedProduct?.SN && <b> Serial Number: </b> && clickedProduct?.SN && <br style={{display : "none"}} />}</li>
                            <li><b> System Model: </b> {clickedProduct?.Machine}</li>
                            <li><b> System Manufacturer: </b> {clickedProduct?.OEM}</li>
                            <li><b> Category: </b> {clickedProduct?.Modality}</li>
                        </ul>

                        <p>Call for Pricing: <Link href="tel:(800) 200-3583">(800) 200-3583</Link></p>
                        {clickedProduct?.Description &&
                            <>
                                <p style={{ marginBottom: "5px" }}><b> Description: </b></p>
                                <p> {clickedProduct?.Description}  </p>
                            </>
                        }
                        <button className='simple-btn' onClick={() => clickModal()}>Request</button>
                    </div>
                </div>
            </div>
            {showPop && <RequestModal closeModal={() => setShowPop(false)} />}
        </>
    )
}
