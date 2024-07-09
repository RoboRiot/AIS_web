"use client"
import {useEffect} from "react"
import Image from "next/image";
import styles from "../how_we_are/howWeAre.module.scss"
import HowWEImage from "@/public/assets/images/who_we_are.jpg"
import AOS from 'aos';
import 'aos/dist/aos.css';

export default function Expansion() {
    useEffect(() => {
        AOS.init();
    },[]);
    return(
        <>
            <div className={`${styles.how_we_are} ${styles.how_expansion}`}>
                <div className="flex items-center container">
                    <figure data-aos="fade-left" data-aos-duration="1000"><Image src={HowWEImage} alt="expertsImage" /></figure>
                    <section data-aos="fade-right" data-aos-duration="1000">
                        <h2>OUR <span> EXPANSION</span></h2>
                        <p>From our beginnings in Northern California, we have rapidly expanded to meet the growing demand for our services across the country. Our reputation for excellence has spread quickly, and we continue to grow, driven by the high quality of our work. Our clients recognize the value we bring, and we are proud to be their first choice for imaging services. We are committed to maintaining our high standards as we expand, ensuring every client receives the best service possible.</p>
                    </section>
                </div>
            </div>
        </>
    )
}