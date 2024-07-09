"use client"
import {useEffect} from "react"
import Image from "next/image"
import styles from "./relatedProducts.module.scss"
import pro1 from "@/public/assets/images/slide1.png"
import pro2 from "@/public/assets/images/slide2.png"
import pro3 from "@/public/assets/images/slide3.png"
import Link from "next/link"
import AOS from 'aos';
import 'aos/dist/aos.css';

export default function RelatedProducts() {
    useEffect(() => {
        AOS.init();
    },[]);
    return(
        <>
            <div className={styles.related_products}>
                <div className="container">
                    <h2 className="main-title">Related <span>products</span></h2>
                    <ul className="list-none flex flex-wrap" data-aos="fade-up" data-aos-duration="1000">
                        <li>
                            <Link href="/product-detail">
                                <figure>
                                    <Image src={pro1} alt="pro1" />
                                    <h3>2215814 Mid Power Inverter</h3>
                                </figure>
                            </Link>
                        </li>
                        <li>
                            <Link href="/product-detail">
                                <figure>
                                    <Image src={pro2} alt="pro2" />
                                    <h3>Rhapsode Intercom 2167014</h3>
                                </figure>
                            </Link>
                        </li>
                        <li>
                            <Link href="/product-detail">
                                <figure>
                                    <Image src={pro3} alt="pro3" />
                                    <h3>2137958-3 Converter Board</h3>
                                </figure>
                            </Link>
                        </li>
                    </ul>
                </div>
            </div>
        </>
    )
}