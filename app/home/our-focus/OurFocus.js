"use client"
import {useEffect} from "react"
import Image from "next/image"
import styles from "./ourFocus.module.scss"
import focusImage from "@/public/assets/images/focus-image.jpg"
import AOS from 'aos';
import 'aos/dist/aos.css';

export default function OurFocus() {
    useEffect(() => {
        AOS.init();
    },[]);
    return(
        <>
            <div className={styles.focus_wrapper}>
                <div className="container">
                    <div className={styles.focus_content}>
                        <section data-aos="fade-in" data-aos-duration="1000">
                            <h2>Our <span>Focus</span></h2>
                            <p>At Advanced Imaging Services, our primary goal is to ensure the optimal performance of your CT and MRI systems, providing you with the reliability and peace of mind you need to focus on patient care.</p>
                            <h3>Real-Time Solutions and Minimized Downtime:</h3>
                            {/* <p>Our remote diagnostics console is a powerful connectivity tool which allows our engineers immediate access to your scanner.</p> */}
                            <ul className="list-none">
                                <li>24/7 accessibility: Our team is always available.</li>
                                <li>Expedited diagnoses: Quick issue identification and resolution.</li>
                                <li>Preventive maintenance: Proactively addressing potential issues.</li>
                                <li>System alerts: Monitoring critical components for faults.</li>
                                <li>HIPAA compliance: Ensuring patient privacy and security.</li>
                                {/* <li>Keen focus on system critical components, i.e. CT Tube, MRI Cryogen levels, MRI Coldhead.</li> */}
                                {/* <li>HIPPA compliant, your patient’s privacy is secure.</li> */}
                            </ul>
                        </section>
                        <figure data-aos="fade-in" data-aos-duration="1000">
                            <Image src={focusImage} alt="focus" />
                        </figure>
                    </div>
                </div>
            </div>
        </>
    )
}