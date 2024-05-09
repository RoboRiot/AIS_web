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
                        <p>Established in 2013, Advanced Imaging Services is California&apos;s go-to for CT and MRI expertise. Our team, with over 40 years of experience including key roles at GE Healthcare and Toshiba, delivers innovative imaging solutions nationwide. We&apos;re a blend of big OEM expertise and the nimbleness of a smaller, focused team. Today, we&apos;re powered by some of the industry&apos;s brightest minds, offering ready-to-go, system-tested parts and OEM-trained engineers. We’re all about quick, reliable service and empowering our customers with full control over their CT scanner operations.</p>
                        <Link href="/about" className="simple-btn">Learn More</Link>
                    </section>
                    <Image src={aboutImage} data-aos="fade-in" data-aos-duration="1000" alt="aboutImage" />
                </div>
            </div>
        </>
    )
}