"use client"
import {useEffect} from "react"
import styles from "./foundYourPart.module.scss"
import AOS from 'aos';
import 'aos/dist/aos.css';

export default function FoundYourPart() {
    useEffect(() => {
        AOS.init();
    },[]);
    return(
        <>
            <div className={styles.found_part_wrap} data-aos="fade-up" data-aos-duration="1000">
                <div className="container">
                    <h2 className="main-title">Found <span>Your Part?</span></h2>
                    <form className="flex w-100">
                        <ul className="list-none">
                            <li><input placeholder="Name" /></li>
                            <li><input placeholder="Email" /></li>
                            <li><input placeholder="Part Number" /></li>
                        </ul>
                        <ul className="list-none">
                            <li><textarea placeholder="Message"></textarea></li>
                            <li><button className="simple-btn">Send</button></li>
                        </ul>
                    </form>
                </div>
            </div>
        </>
    )
}