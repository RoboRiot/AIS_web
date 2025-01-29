"use client"
import {useEffect} from "react"
import Image from "next/image";
import styles from "./ctServices.module.scss"
import weDoImage from "@/public/assets/images/ct_services.jpg"
import Link from "next/link";
import AOS from 'aos';
import 'aos/dist/aos.css';

export default function CtServices() {
    useEffect(() => {
        AOS.init();
    },[]);
    return(
        <>
            <div className={styles.mobile_mri} id="service2">
                <div className="flex items-center container">
                    <figure data-aos="fade-left" data-aos-duration="1000"><Image src={weDoImage} alt="weDoImage" /></figure>
                    <section data-aos="fade-right" data-aos-duration="1000">
                        <h2>Comprehensive CT <span> Service Solutions</span></h2>
                        <p>Tailored, Swift, and Superior Our close-knit team at Advanced Imaging treats every CT service with the urgency and attention only a client-centered company can offer. We&apos;re proud to provide a rapid turnaround on repairs and maintenance, with a hands-on approach that means you&apos;ll know who&apos;s working on your equipment—and how to reach them—every step of the way. Our promise: Your CT services will be handled with exceptional expertise and a personal commitment you won&apos;t find elsewhere. Experience the difference at.</p>
                        <Link href="/contact" className="simple-btn">Contact Us for More Details</Link>
                    </section>
                </div>
            </div>
        </>
    )
}