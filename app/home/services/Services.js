"use client"
import {useEffect} from "react"
import Image from "next/image"
import styles from "./services.module.scss"
import servicesList from "./servicesList.json"
import Link from "next/link";
import AOS from 'aos';
import 'aos/dist/aos.css';

export default function Services() { 
    useEffect(() => {
        AOS.init();
    },[]);
    return(
        <>
            <div className={styles.services_wrapper}>
                <div className="container">
                    <h2 className="main-title">Our <span>Services</span></h2>
                    <div className={styles.services_list_wrap}>
                        <ul className="list-none">
                            {
                                servicesList.map(({listImage,listTitle,listDescription,link, pageLink},index)=>{
                                    return(
                                        <li key={`list-${index}`} className="flex items-center">
                                            <section data-aos="fade-in" data-aos-duration="1000">
                                                <h3>{listTitle}</h3>
                                                <p>{listDescription} <Link href="/">{link}</Link></p>
                                                <a href={pageLink} className="learn_more">Learn More</a>
                                            </section>
                                            <figure data-aos="fade-in" data-aos-duration="1000">
                                                <Image src={listImage} width={690} height={499} alt="image" />
                                            </figure>
                                        </li>
                                    )
                                })
                            }
                        </ul>
                    </div>
                </div>
            </div>
        </>
    )
}