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
  const [prevScrollPos, setPrevScrollPos] = useState(0);
  const [visible, setVisible] = useState(true);
  const [data, setData] = useState([]);


  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      if (scrollPosition > 190) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);


  useEffect(() => {
    const handleScroll = () => {
      const currentScrollPos = window.pageYOffset || document.documentElement.scrollTop;

      // Header will hide only after scrolling 190px
      if (currentScrollPos > 190) {
        const isVisible = prevScrollPos > currentScrollPos;
        setPrevScrollPos(currentScrollPos);
        setVisible(isVisible);
      }
    };

    // Listen to scroll events only on the client side
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', handleScroll);
      return () => {
        window.removeEventListener('scroll', handleScroll);
      };
    }
  }, [prevScrollPos]);

    return(
        <>
            <header className={`${scrolled ? styles.sticky_header : ''} ${visible ? '' : styles.hide_header} ${visible ? styles.header_animation : ''} ${styles.header}`}>
                <div className={styles.header_strip}>
                    <div className="container flex">
                        <span>ISO 9001:2015 Certified</span>
                        <ul>
        {data.map((item, index) => (
          <li key={index}>{JSON.stringify(item)}</li>
        ))}
      </ul>
                        <ul className="list-none flex items-center ml-auto">
                            <li className="flex items-center"><Image src={phoneIcon} alt="phone" /><Link href="tel:(800)200-3583">(800) 200-3583</Link></li>
                            <li className="flex items-center"><Image src={emailIcon} alt="email" /><Link href="mailto:info@advancedimagingparts.com">info@advancedimagingparts.com</Link></li>
                        </ul>
                    </div>
                </div>
                <Navigation/>
            </header>
        </>
    )
}