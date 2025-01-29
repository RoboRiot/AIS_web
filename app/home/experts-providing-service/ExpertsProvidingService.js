"use client";
import {Fragment, useState, useEffect} from "react";
import styles from "./expertsProvidingService.module.scss";
import expertsProvidingServiceList from "./expertsProvidingServiceList.json";
import Image from "next/image";
import AOS from 'aos';
import 'aos/dist/aos.css';

export default function ExpertsProvidingService() {
    const [tabs, setTabs] = useState(0);
    useEffect(() => {
        AOS.init();
    },[]);

    return(
        <>
            <div className={styles.tab_wrapper}>
                <div className="container">
                    <h2 className="main-title">Experts <span>Providing Service</span></h2>
                    <div className={styles.tab_list}>
                        <div className={styles.tab_button} data-aos="fade-right" data-aos-duration="1000">
                            <ul className="list-none flex direction-column">
                                {
                                    expertsProvidingServiceList.map(({icon,tabButton},index)=>{
                                        return(
                                            <li
                                                key={`tab-${index}`}
                                                onClick={() => setTabs(index)}
                                                className={`flex ${ tabs === index ? styles.active : ""}`}
                                            >
                                                <button
                                                >
                                                    <Image src={icon} alt="icon" width={38} height={38} /><span>{tabButton}</span>
                                                </button>
                                            </li>
                                        )
                                    })
                                }
                            </ul>
                        </div>
                        <div className={styles.tab_list_content} data-aos="fade-left" data-aos-duration="1000">
                            {
                                expertsProvidingServiceList.map(({tabButton,tabImage,tabDescription},index)=>{
                                    if (tabs === index) {
                                        return(
                                            <Fragment key={`tabContent-${index}`}>
                                                <section>
                                                    <h2>{tabButton}</h2>
                                                    <p>{tabDescription}</p>
                                                </section>
                                                <Image src={tabImage} alt="tabImage" width={462} height={341} />
                                            </Fragment>
                                        )
                                    }
                                })
                            }
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}