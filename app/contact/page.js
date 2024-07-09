"use client"
import {useEffect} from "react"
import Subheader from "@/components/subheader/Subheader";
import styles from "./contact.module.scss"
import Image from "next/image";
import phoneIcon from "@/public/assets/images/phoneicon.svg"
import emailIcon from "@/public/assets/images/emailicon.svg"
import locationIcon from "@/public/assets/images/location.svg"
import facebook from "@/public/assets/images/facebook.svg"
import linkedin from "@/public/assets/images/linkedin.svg"
import twitter from "@/public/assets/images/twitter.svg"
import Testimonial from "../home/testimonial/Testimonial";
import AOS from 'aos';
import 'aos/dist/aos.css';

export default function Contact() {
  useEffect(() => {
    AOS.init();
},[]);
  return (
    <>
      <Subheader
        title={['Contact ', <span key="1">Us</span>]}
        extraClass="contact_bg"
      />
      <div className={`${styles.contact_wrapper} flex direction-column`}>
        <div className={styles.section_title}>
          <h2>Get in Touch <span>with Us</span></h2>
          <p>We would love to hear from you. Please feel free to reach <br/>out to us!</p>
        </div>
        <div className="container flex">
          <form data-aos="fade-left" data-aos-duration="1000">
            <ul className="list-none flex direction-column">
              <li><input placeholder="NAME" /></li>
              <li><input placeholder="EMAIL" /></li>
              <li><textarea placeholder="MESSAGE"></textarea></li>
              <li><button className="simple-btn">Send Message</button></li>
            </ul>
          </form>
          <div className={styles.contact_info} data-aos="fade-right" data-aos-duration="1000">
              <h3>Contact Info</h3>
              <ul className={`list-none flex direction-column ${styles.contact_info_list}`}>
                  <li><Image src={phoneIcon} alt="icon" /><a href="tel:(800) 200-3583">(800) 200-3583</a></li>
                  <li><Image src={emailIcon} alt="icon" /><a href="mailto:info@advancedimagingparts.com">info@advancedimagingparts.com</a></li>
                  <li><Image src={locationIcon} alt="icon" /><span>17410 Murphy Pkwy. Lathrop, CA 95330</span></li>
              </ul>
              <h3>Follow Us</h3>
              <ul className={`list-none flex ${styles.social_list}`}>
                  <li><a href="https://www.facebook.com/" target="_blank"><Image src={facebook} alt="icon" /></a></li>
                  <li><a href="https://www.linkedin.com/" target="_blank"><Image src={linkedin} alt="icon" /></a></li>
                  <li><a href="https://twitter.com/" target="_blank"><Image src={twitter} alt="icon" /></a></li>
              </ul>
          </div>
        </div>
        <div className={`contact_map ${styles.contact_map}`}>
          <Testimonial/>
        </div>
      </div>
    </>
  );
}
