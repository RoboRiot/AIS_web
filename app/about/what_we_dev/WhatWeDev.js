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
                        <p>Provide solutions! We respond, provide and deliver. Our value is realized from the unique care, investments and quality placed into our services and products. We have experts in every department, who are dedicated to providing quick and reliable solutions. We empower our customers, allowing them full coverage of their CT scanner’s parts, services and technical support, which allows them deeper control over their metrics.</p>
                    </section>
                    <figure data-aos="fade-right" data-aos-duration="1000"><Image src={weDoImage} alt="weDoImage" /></figure>
                </div>
            </div>
        </>
    )
}