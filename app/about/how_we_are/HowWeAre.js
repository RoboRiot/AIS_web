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
            <div className={styles.how_we_are} id="targetElement">
                <div className="flex items-center container">
                    <figure data-aos="fade-left" data-aos-duration="1000"><Image src={HowWEImage} alt="expertsImage" /></figure>
                    <section data-aos="fade-right" data-aos-duration="1000">
                        <h2>Who <span> We Are</span></h2>
                        <p>For the past 20 years, we have been committed to delivering high-quality imaging parts and services, forging lasting relationships with our clients, and achieving outstanding results. Advanced Imaging is on its way to becoming the top service company in the field, thanks to our exceptional talent and consistent performance. Our engineers are trained to the highest standards, and our imaging parts are rigorously tested to ensure they are ready to meet the demands of our clients.</p>
                    </section>
                </div>
            </div>
        </>
    )
}