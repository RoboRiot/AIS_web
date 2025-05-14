"use client"
import {useEffect} from "react"
import Image from "next/image"
import styles from "./getInTouch.module.scss"
import phoneIcon from "@/public/assets/images/phoneicon.svg"
import emailIcon from "@/public/assets/images/emailicon.svg"
import locationIcon from "@/public/assets/images/location.svg"
import facebook from "@/public/assets/images/facebook.svg"
import linkedin from "@/public/assets/images/linkedin.svg"
import twitter from "@/public/assets/images/twitter.svg"
import AOS from 'aos';
import 'aos/dist/aos.css';

export default function GetInTouch() {
    useEffect(() => {
        AOS.init();
    },[]);
    return(
        <>
            <div className={styles.get_wrapper}>
                <div className="container">
                    <div className={`flex items-center ${styles.get_bg_wrapper}`}>
                        <section data-aos="fade-left" data-aos-duration="1000">
                            <h2>Get In <span>Touch</span></h2>
                            <p>With 100% Coverage of all GE and Toshiba CT parts, Advanced Imaging offers the ability to make sure our customers spend as little downtime as possible. We improve both our parts inventory and quality assurance methods on a regular basis, stocking hard to find parts, so we can be the fastest to get our customers up and running!</p>
                            <p>We would love to hear from you. Please feel free to reach out to us!</p>
                            <a href="/contact" className="simple-btn">Contact Us</a>
                        </section>
                        <div className={styles.contact_info} data-aos="fade-right" data-aos-duration="1000">
                            <h3>Contact Info</h3>
                            <ul className={`list-none flex direction-column ${styles.contact_info_list}`}>
                                <li><Image src={phoneIcon} alt="icon" /><a href="tel:(800) 200-3583">(800) 200-3583</a></li>
                                <li><Image src={emailIcon} alt="icon" /><a href="mailto:info@advancedimagingparts.com">info@advancedimagingparts.com</a></li>
                                <li><Image src={locationIcon} alt="icon" /><span>17410 Murphy Pkwy. Lathrop, CA 95330</span></li>
                            </ul>
                            <h3>Follow Us</h3>
                            <ul className={`list-none flex ${styles.social_list}`}>
                                <li><a href="https://www.facebook.com/" target="_blank"><Image src={facebook} alt="icon" /></a></li>
                                <li><a href="https://www.linkedin.com/" target="_blank"><Image src={linkedin} alt="icon" /></a></li>
                                <li><a href="https://twitter.com/" target="_blank"><Image src={twitter} alt="icon" /></a></li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}