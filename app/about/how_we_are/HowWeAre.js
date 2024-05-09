"use client"
import {useEffect} from "react"
import Image from "next/image";
import styles from "./howWeAre.module.scss"
import HowWEImage from "@/public/assets/images/who_we_are.jpg"
import AOS from 'aos';
import 'aos/dist/aos.css';

export default function HowWeAre() {
    useEffect(() => {
        AOS.init();
    },[]);
    return(
        <>
            <div className={styles.how_we_are}>
                <div className="flex items-center container">
                    <figure data-aos="fade-left" data-aos-duration="1000"><Image src={HowWEImage} alt="expertsImage" /></figure>
                    <section data-aos="fade-right" data-aos-duration="1000">
                        <h2>Who <span> We Are</span></h2>
                        <p>For the past 5 years, we have made it our mission to nationally provide great imaging parts and services, establish long-lasting relationships and ensure we enjoy every step of the way. Today, Advanced Imaging is ablaze, employing some of the brightest talent in the industry and producing record breaking & time-saving experiences. Our engineers are OEM trained and our imaging parts are system tested. Both are ready to go, as soon as they’re needed!</p>
                    </section>
                </div>
            </div>
        </>
    )
}