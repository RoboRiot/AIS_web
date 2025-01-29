"use client"
import Link from "next/link"
import { useEffect } from 'react';
import styles from "./footer.module.scss"
import Image from "next/image"
import logoImage from "@/public/assets/images/logo.svg"
import phoneIcon from "@/public/assets/images/phoneicon.svg"
import emailIcon from "@/public/assets/images/emailicon.svg"
import locationIcon from "@/public/assets/images/location.svg"
import facebook from "@/public/assets/images/facebook.svg"
import linkedin from "@/public/assets/images/linkedin.svg"
import twitter from "@/public/assets/images/twitter.svg"
import heartIcon from "@/public/assets/images/heart.svg"

function smoothScrollTo(hash, offset = 0) {
  const target = document.querySelector(hash);
  if (target) {
    window.scrollTo({
      top: target.offsetTop - offset,
      behavior: 'smooth'
    });
  }
}

function handleScrollClick(event) {
  const hash = event.target.hash;
  if (hash !== "") {
    event.preventDefault();
    smoothScrollTo(hash, 200);
  }
}

export default function Footer() {
    useEffect(() => {
        const scrollLinks = document.querySelectorAll('a.bottom-scroll');
        scrollLinks.forEach(link => {
          link.addEventListener('click', handleScrollClick);
        });
        return () => {
          scrollLinks.forEach(link => {
            link.removeEventListener('click', handleScrollClick);
          });
        };
      }, []);

    const currentYear = new Date().getFullYear();
    return(
        <>
            <footer className={`flex direction-column ${styles.footer_wrapper}`}>
                <div className="container">
                    <div className={styles.footer_widget}>
                        <div className={styles.footer_info}>
                            <Link href="/"><Image src={logoImage} alt="footer_logo" /></Link>
                            <p>At Advanced Imaging Parts, we believe that the best service comes from the knowledge and personal care of our staff. That is why we only hire the very best Field-Service Engineers, coupled with our proprietary support and remote diagnostic network, to ensure that the customer spends as little time down as possible, saving them money in the process. ISO: 9001-2015</p>
                        </div>
                        <div className={styles.footer_links}>
                            <h4 className="footer_title">quick Links</h4>
                            <ul className="list-none">
                                <li><Link href="/">Home</Link></li>
                                <li><Link href="/about">Our Story</Link></li>
                                <li><Link href="/services">Our Services</Link></li>
                                <li><Link href="/parts">Parts</Link></li>
                                <li><Link href="/contact">Contact Us</Link></li>
                                <li><Link href="/parts">Search</Link></li>
                            </ul>
                        </div>
                        <div className={styles.contact_info}>
                            <h4 className="footer_title">Contact Info</h4>
                            <ul className={`list-none flex direction-column ${styles.contact_info_list}`}>
                                <li><Image src={phoneIcon} alt="icon" /><a href="tel:(800) 200-3583">(800) 200-3583</a></li>
                                <li><Image src={emailIcon} alt="icon" /><a href="mailto:info@advancedimagingparts.com">info@advancedimagingparts.com</a></li>
                                <li><Image src={locationIcon} alt="icon" /><span>17410 Murphy Pkwy. Lathrop, CA 95330</span></li>
                            </ul>
                            <h4 className="footer_title">Follow Us</h4>
                            <ul className={`list-none flex ${styles.social_list}`}>
                                <li><a href="https://www.facebook.com/" target="_blank"><Image src={facebook} alt="icon" /></a></li>
                                <li><a href="https://www.linkedin.com/" target="_blank"><Image src={linkedin} alt="icon" /></a></li>
                                <li><a href="https://twitter.com/" target="_blank"><Image src={twitter} alt="icon" /></a></li>
                            </ul>
                        </div>
                    </div>
                </div>
                <div className={styles.copyright}>
                    <div className="container">
                        <span>Copyrights © {currentYear} All Rights Reserved.</span>
                        <span>Developed with <Image src={heartIcon} alt="heart" /> by <Link href="https://www.softenica.com/" target="_blank"> Softenica Technologies</Link></span>
                    </div>
                </div>
            </footer>
        </>
    )
}