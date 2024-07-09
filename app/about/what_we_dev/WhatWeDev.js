"use client"
import {useEffect} from "react"
import Image from "next/image";
import styles from "./whatWeDev.module.scss"
import weDoImage from "@/public/assets/images/we_do.jpg"
import AOS from 'aos';
import 'aos/dist/aos.css';

export default function WhatWeDev() {
    useEffect(() => {
        AOS.init();
    },[]);
    return(
        <>
            <div className={styles.mri_experts}>
                <div className="flex items-center container">
                    <section data-aos="fade-left" data-aos-duration="1000">
                        <h2>What <span> We Do</span></h2>
                        <p>We provide comprehensive maintenance and repair services for CT, MRI, and Mobile MRI and CT systems. Our value lies in the meticulous attention and quality we bring to our work. With a team of experienced professionals, we ensure quick and reliable solutions, minimizing downtime and keeping your equipment in top condition. We pride ourselves on clear communication and exceptional service, making us a trusted partner for hospitals and clinics.</p>
                    </section>
                    <figure data-aos="fade-right" data-aos-duration="1000"><Image src={weDoImage} alt="weDoImage" /></figure>
                </div>
            </div>
        </>
    )
}