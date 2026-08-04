"use client"
import { useEffect, useState } from 'react';
import Link from "next/link"
import styles from "./header.module.scss"
import Image from "next/image"
import phoneIcon from "@/public/assets/images/phoneicon.svg"
import emailIcon from "@/public/assets/images/emailicon.svg"
import Navigation from "./Navigation"


export default function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollPos = window.pageYOffset || document.documentElement.scrollTop;
      const isScrolled = currentScrollPos > 190;

      setScrolled((current) => (current === isScrolled ? current : isScrolled));
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

    return(
        <>
            <header className={`${scrolled ? styles.sticky_header : ''} ${styles.header_animation} ${styles.header}`}>
                <div className={styles.header_strip}>
                    <div className="container flex">
                        <span>ISO 9001:2015 Certified</span>
                        <ul className="list-none flex items-center ml-auto">
                            <li className="flex items-center"><Image src={phoneIcon} alt="phone" /><Link href="tel:+15595376851">(559) 537-6851</Link></li>
                            <li className="flex items-center"><Image src={emailIcon} alt="email" /><Link href="mailto:info@advancedimagingparts.com">info@advancedimagingparts.com</Link></li>
                        </ul>
                    </div>
                </div>
                <Navigation/>
            </header>
        </>
    )
}
