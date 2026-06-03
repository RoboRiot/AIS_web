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
                    <figure data-aos="fade-left" data-aos-duration="1000"><Image src={weDoImage} alt="Comprehensive mobile CT trailer service solutions" /></figure>
                    <section data-aos="fade-right" data-aos-duration="1000">
                        <h2>Comprehensive CT <span> Service Solutions</span></h2>
                        <p>Advanced Imaging delivers tailored CT service for both fixed installations and mobile CT trailer programs. From preventive maintenance and emergency troubleshooting to component replacement and calibration, our engineers support high-demand environments that require fast turnaround and clear communication.</p>
                        <p>We also support mobile PET CT trailer workflows and related imaging logistics, helping your team maintain performance, compliance, and patient access across rotating sites.</p>
                        <Link href="/contact" className="simple-btn">Contact Us for More Details</Link>
                    </section>
                </div>
            </div>
        </>
    )
}