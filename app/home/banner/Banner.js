import Image from "next/image"
import styles from "./banner.module.scss"
import bannerImage from "@/public/assets/images/banner-img1.png"
import Link from "next/link"

export default function Banner() {
    return(
        <>
            <div className={`flex items-center ${styles.banner_main_wrapper}`}>
                <div className="container flex">
                    <section>
                        <small>Welcome to</small>
                        <h1>Advanced <span>Imaging</span></h1>
                        <p>We provide parts, accessories, repairs, and <br/>maintenance for the world&apos;s leading CT and <br/>MRI scanning equipment. </p>
                        <Link href="/contact" className="simple-btn">Contact Us</Link>
                    </section>
                    <Image src={bannerImage} alt="bannerImage" />
                </div>
            </div>
        </>
    )
}