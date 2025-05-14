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
                        <p>Immediate, Expert Care When You Need It Most At Advanced Imaging, we’re not just experts, we’re the rapid-response team for MRI machines. Our family-operated business means you get a personal touch with direct communication, bypassing the red tape of larger corporations. With some of the finest specialists on call 24/7, we commit to getting your MRI up and running faster than anyone else, minimizing downtime with a commitment that’s as strong as family. For service that brings your equipment back to life swiftly, visit us at</p>
                        <Link href="/contact" className="simple-btn">Contact Us for More Details</Link>
                    </section>
                    <figure data-aos="fade-right" data-aos-duration="1000"><Image src={weDoImage} alt="weDoImage" /></figure>
                </div>
            </div>
        </>
    )
}