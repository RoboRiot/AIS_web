"use client"
import {useEffect} from "react"
import Image from "next/image";
import styles from "./mriExperts.module.scss"
import expertsImage from "@/public/assets/images/experts.jpg"
import AOS from 'aos';
import 'aos/dist/aos.css';

export default function MriExperts() {
    useEffect(() => {
        AOS.init();
    },[]);
    return(
        <>
            <div className={styles.mri_experts}>
                <div className="flex items-center container">
                    <section data-aos="fade-left" data-aos-duration="1000">
                        <h2>California’s CT<span> and MRI Experts</span></h2>
                        <p>Established in 2013, Advanced Imaging Services is California&apos;s go-to for CT and MRI expertise. Our team, with over 40 years of experience including key roles at GE Healthcare and Toshiba, delivers innovative imaging solutions nationwide. We&apos;re a blend of big OEM expertise and the nimbleness of a smaller, focused team. Today, we&apos;re powered by some of the industry&apos;s brightest minds, offering ready-to-go, system-tested parts and OEM-trained engineers. We’re all about quick, reliable service and empowering our customers with full control over their CT scanner operations.</p>
                    </section>
                    <figure data-aos="fade-right" data-aos-duration="1000"><Image src={expertsImage} alt="expertsImage" /></figure>
                </div>
            </div>
        </>
    )
}