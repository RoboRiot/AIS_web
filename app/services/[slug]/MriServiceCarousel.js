"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import styles from "../landingPage.module.scss";

const mriSlides = [
  {
    src: "/assets/images/mri-service-1.jpeg",
    alt: "MRI scanner room with patient table and clinical equipment",
  },
  {
    src: "/assets/images/mri-service-2.jpeg",
    alt: "MRI scanner bore and patient table in imaging suite",
  },
  {
    src: "/assets/images/mri-service-3.jpeg",
    alt: "MRI scanner close view with patient table and controls",
  },
];

export default function MriServiceCarousel({ title }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % mriSlides.length);
    }, 4800);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <figure className={`${styles.figure} ${styles.serviceCarouselFigure}`}>
      <div className={styles.serviceCarouselFrame}>
        {mriSlides.map((slide, index) => (
          <Image
            key={slide.alt}
            src={slide.src}
            alt={`${title}: ${slide.alt}`}
            fill
            priority={index === 0}
            sizes="(max-width: 1100px) 100vw, 45vw"
            className={index === activeIndex ? styles.carouselActive : ""}
          />
        ))}
      </div>
      <div className={styles.carouselDots} aria-label="MRI service image carousel controls">
        {mriSlides.map((slide, index) => (
          <button
            key={slide.alt}
            type="button"
            aria-label={`Show MRI service image ${index + 1}`}
            aria-pressed={index === activeIndex}
            onClick={() => setActiveIndex(index)}
            className={index === activeIndex ? styles.carouselDotActive : ""}
          />
        ))}
      </div>
    </figure>
  );
}
