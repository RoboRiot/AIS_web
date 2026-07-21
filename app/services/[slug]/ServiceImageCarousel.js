"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import styles from "../landingPage.module.scss";

export default function ServiceImageCarousel({ title, slides }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return undefined;

    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 4800);

    return () => window.clearInterval(interval);
  }, [slides.length]);

  return (
    <figure className={`${styles.figure} ${styles.serviceCarouselFigure}`}>
      <div className={styles.serviceCarouselFrame}>
        {slides.map((slide, index) => (
          <Image
            key={slide.id}
            src={slide.src}
            alt={`${title}: ${slide.alt}`}
            fill
            priority={index === 0}
            sizes="(max-width: 1100px) 100vw, 45vw"
            className={index === activeIndex ? styles.carouselActive : ""}
          />
        ))}
      </div>
      {slides.length > 1 && (
        <div className={styles.carouselDots} aria-label={`${title} service image carousel controls`}>
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              aria-label={`Show ${title} service image ${index + 1}`}
              aria-pressed={index === activeIndex}
              onClick={() => setActiveIndex(index)}
              className={index === activeIndex ? styles.carouselDotActive : ""}
            />
          ))}
        </div>
      )}
    </figure>
  );
}
