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
                            <p>Ensure our client’s peace-of-mind, having them know their system is operating at optimal performance at all times.</p>
                            <h3>Real Time Solutions Increased “Uptime”</h3>
                            <p>Our remote diagnostics console is a powerful connectivity tool which allows our engineers immediate access to your scanner.</p>
                            <ul className="list-none">
                                <li>24 hours accessibility.</li>
                                <li>Expedited diagnoses, improving both the speed and accuracy of a solution.</li>
                                <li>Virtually resolve majority of issues.</li>
                                <li>Reduce downtime by forecasting preventive maintenance needs.</li>
                                <li>Alerts our engineers of potential system faults.</li>
                                <li>Keen focus on system critical components, i.e. CT Tube, MRI Cryogen levels, MRI Coldhead.</li>
                                <li>HIPPA compliant, your patient’s privacy is secure.</li>
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