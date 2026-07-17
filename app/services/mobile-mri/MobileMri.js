"use client"
import {useEffect} from "react"
import Image from "next/image";
import styles from "./mobileMri.module.scss"
import weDoImage from "@/public/assets/images/mobile-mri.jpg"
import weDoImage2 from "@/public/assets/images/mobile-mri2.jpg"
import Link from "next/link";
import AOS from 'aos';
import 'aos/dist/aos.css';
import downArrow from "@/public/assets/images/down-arrow.svg"

export default function MobileMri({ showFleetPricing = true }) {
    useEffect(() => {
        AOS.init();
    },[]);
    const handleScroll = () => {
        const targetElement = document.getElementById('targetElement');
        if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth' });
        }
    };
    return(
        <>
            <div className={styles.mobile_mri} id="service3">
                <div className="container">
                    <div className={styles.section_title}>
                        <h2>Mobile Imaging <span>Services</span></h2>
                        <p>Advanced Imaging supports hospitals, clinics, and outpatient centers with mobile medical trailer solutions for MRI, CT, and PET/CT environments. We provide rental, maintenance, and rapid-response field service for mission-critical mobile imaging operations.</p>
                        <Image onClick={handleScroll} className="down_animation" src={downArrow} alt="down-arrow" />
                    </div>
                </div>
                <div className="flex items-center container" id="targetElement">
                    <section data-aos="fade-left" data-aos-duration="1000">
                        <h2>Mobile MRI & CT Trailer <span>Rental and Service</span></h2>
                        <p>Need dependable mobile MRI trailer or mobile CT trailer coverage? Our team delivers flexible MRI trailer rental and CT trailer rental options, plus 24/7 technical support. We service major OEM platforms including GE mobile MRI, Siemens mobile MRI, and Toshiba/Canon mobile imaging systems, with experienced technicians focused on uptime, image quality, and patient throughput.</p>
                        <p>We help facilities plan around mobile MRI trailer cost factors, replacement timelines, mobile CT scan trailer needs, portable CT trailer support, and mobile PET/CT trailer operations. Whether the need is emergency downtime coverage or a planned long-term lease, the goal is the same: keep diagnostic imaging available for patients.</p>
                        <Link href="/contact" className="simple-btn">Contact Us for More Details</Link>
                    </section>
                    <figure data-aos="fade-right" data-aos-duration="1000"><Image src={weDoImage} alt="Mobile MRI trailer service and rental support" /></figure>
                </div>
                {showFleetPricing && (
                    <div className="container">
                        <div className={`flex items-center ${styles.section_second}`}>
                            <figure data-aos="fade-left" data-aos-duration="1000"><Image src={weDoImage2} alt="Mobile CT trailer fleet for hospital imaging programs" /></figure>
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
                )}
            </div>
        </>
    )
}
