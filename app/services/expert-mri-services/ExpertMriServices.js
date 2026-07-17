"use client"
import {useEffect} from "react"
import Image from "next/image";
import styles from "./expertMriServices.module.scss"
import weDoImage from "@/public/assets/images/e-mri.jpg"
import Link from "next/link";
import AOS from 'aos';
import 'aos/dist/aos.css';

export default function ExpertMriServices() {
    useEffect(() => {
        AOS.init();
    },[]);
    return(
        <>
            <div className={styles.mri_experts} id="service1">
                <div className="flex items-center container">
                    <section data-aos="fade-left" data-aos-duration="1000">
                        <h2>Expert <span> MRI Service</span></h2>
                        <p>Immediate expert care for MRI systems. Advanced Imaging provides fast-response diagnostics, repair, PM support, and parts coordination for GE, Siemens, and Toshiba/Canon MRI platforms used in hospitals and outpatient imaging suites. Our 24/7 coverage is designed to reduce downtime and keep your schedule moving.</p>
                        <Link href="/contact" className="simple-btn">Contact Us for More Details</Link>
                    </section>
                    <figure data-aos="fade-right" data-aos-duration="1000"><Image src={weDoImage} alt="Expert MRI service team for medical imaging systems" /></figure>
                </div>
            </div>
        </>
    )
}
