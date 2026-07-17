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
                    <figure data-aos="fade-left" data-aos-duration="1000"><Image src={weDoImage} alt="Comprehensive CT scanner service solutions" /></figure>
                    <section data-aos="fade-right" data-aos-duration="1000">
                        <h2>Comprehensive CT <span> Service Solutions</span></h2>
                        <p>Advanced Imaging delivers tailored CT service for high-use clinical environments. From preventive maintenance and emergency troubleshooting to component replacement and calibration, our engineers support departments that require fast turnaround and clear communication.</p>
                        <p>We help imaging teams maintain performance, protect schedule continuity, and coordinate service needs across GE, Siemens, and Toshiba/Canon CT platforms.</p>
                        <Link href="/contact" className="simple-btn">Contact Us for More Details</Link>
                    </section>
                </div>
            </div>
        </>
    )
}
