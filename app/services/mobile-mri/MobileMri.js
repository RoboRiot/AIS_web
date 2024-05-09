"use client"
import {useEffect} from "react"
import Image from "next/image";
import styles from "./mobileMri.module.scss"
import weDoImage from "@/public/assets/images/mobile-mri.jpg"
import weDoImage2 from "@/public/assets/images/mobile-mri2.jpg"
import Link from "next/link";
import AOS from 'aos';
import 'aos/dist/aos.css';

export default function MobileMri() {
    useEffect(() => {
        AOS.init();
    },[]);
    return(
        <>
            <div className={styles.mobile_mri} id="service3">
                <p>Our company specializes in servicing all MRI and CT machines, a cornerstone of our business that we would like to be the primary focus of the first page of the ad. Additionally, we provide comprehensive services for MRI and CT trailers which we would like to be highlighted on the first page as well.</p>
                <div className="flex items-center container">
                    <section data-aos="fade-left" data-aos-duration="1000">
                        <h2>Mobile MRI & CT Trailer <span> Rentals and Service</span></h2>
                        <p>Personalized, Dependable, Around-the-Clock Choose Advanced Imaging for more than just rentals; choose us for a partnership. We offer an exclusive fleet of GE and Siemens MRI, and GE and Toshiba CT mobile trailers, supported by a service team that&apos;s always on standby. As a family business, we ensure not only the functionality but the constant care of our units. We&apos;re here for you at any hour, providing not just equipment, but peace of mind with every rental. For flexible solutions and service with a personal touch, visit us at <Link href="/">https://www.advancedimagingparts.com/</Link></p>
                    </section>
                    <figure data-aos="fade-right" data-aos-duration="1000"><Image src={weDoImage} alt="weDoImage" /></figure>
                </div>
                <div className="container">
                    <div className={`flex items-center ${styles.section_second}`}>
                        <figure data-aos="fade-left" data-aos-duration="1000"><Image src={weDoImage2} alt="weDoImage" /></figure>
                        <section data-aos="fade-right" data-aos-duration="1000">
                            <h2>Our Mobile <span> Fleet</span></h2>
                            <p>Monthly pricing for one year lease starting at:</p>
                            <ul className="list-none">
                                <li>GE HDxt <span>$25,000</span></li>
                                <li>GE Evo <span>$25,000</span></li>
                                <li>GE DVCT STE <span>$35,000</span></li>
                                <li>Siemens Aera <span>$48,000</span></li>
                                <li>Siemens Espree <span>$32,000</span></li>
                                <li>Siemens Definition <span>$27,500</span></li>
                                <li>Canon Prime 160 <span>$27,000</span></li>
                                <li>Canon Aquilion CXL <span>$25,000</span></li>
                            </ul>
                        </section>
                    </div>
                </div>
            </div>
        </>
    )
}