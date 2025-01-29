"use client"
import {useEffect} from "react"
import Image from "next/image"
import styles from "./about.module.scss"
import aboutImage from "@/public/assets/images/about-img.png"
import Link from "next/link"
import AOS from 'aos'; 
import 'aos/dist/aos.css';

export default function About() {
    useEffect(() => {
        AOS.init();
    },[]);
    return(
        <> 
            <div className={styles.about_main_wrapper}>
                <div className="container flex items-center">
                    <section data-aos="fade-in" data-aos-duration="1000">
                        <h2>About <span>Us</span></h2>
                        <p>Founded in 2013, Advanced Imaging Services specializes in CT and MRI maintenance and repair across the U.S. With over 40 years of combined experience from leading industry roles, our team is dedicated to ensuring the reliability and performance of imaging equipment. We provide system-tested parts and highly skilled engineers, delivering prompt and dependable service. Our focus is on minimizing downtime and maintaining seamless operations for our clients. Discover more about our commitment to excellence and how we support our customers by clicking the link below.</p>
                        <Link href="/about" className="simple-btn">Learn More</Link>
                    </section>
                    <Image src={aboutImage} data-aos="fade-in" data-aos-duration="1000" alt="aboutImage" />
                </div>
            </div>
        </>
    )
}