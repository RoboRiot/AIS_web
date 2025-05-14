"use client"
import {useEffect} from "react"
import Image from "next/image";
import styles from "./mriExperts.module.scss"
import downArrow from "@/public/assets/images/down-arrow.svg"
import AOS from 'aos';
import 'aos/dist/aos.css';

export default function MriExperts() {
    useEffect(() => {
        AOS.init();
    },[]);

    const handleScroll = () => {
        const targetElement = document.getElementById('targetElement');
        if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth' });
        }
    };
    return(
        <>
            <div className={styles.mri_experts}>
                <div className="container">
                    <div className={styles.section_title}>
                        <h2>Our <span>Story</span></h2>
                        <p>Founded in 2013, Advanced Imaging Services specializes in providing comprehensive CT and MRI maintenance and repair services across the U.S. Our team brings over 40 years of combined experience from industry leaders. We are committed to ensuring the reliable performance of imaging equipment nationwide. By offering system-tested parts and employing highly skilled engineers, we deliver consistent and prompt service, supporting our clients in maintaining seamless CT and MRI operations.</p>
                        <Image onClick={handleScroll} className="down_animation" src={downArrow} alt="down-arrow" />
                    </div>
                </div>
            </div>
        </>
    )
}