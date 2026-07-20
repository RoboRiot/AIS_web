"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import styles from "@/app/services/landingPage.module.scss";

const fallbackSlides = [
  {
    id: "fallback/interior-1.avif",
    src: "/assets/images/interior-1.avif",
    alt: "Mobile MRI trailer interior exam room",
    category: "Interior",
  },
  {
    id: "fallback/interior-2.webp",
    src: "/assets/images/interior-2.webp",
    alt: "Mobile MRI trailer interior floor plan",
    category: "Interior",
  },
  {
    id: "fallback/exterior-1.jpg",
    src: "/assets/images/exterior-1.jpg",
    alt: "Mobile MRI trailer exterior side view",
    category: "Exterior",
  },
  {
    id: "fallback/mobile-mri.jpg",
    src: "/assets/images/mobile-mri.jpg",
    alt: "Mobile MRI trailer interior cutaway layout",
    category: "Interior",
  },
  {
    id: "fallback/mobile-mri2.jpg",
    src: "/assets/images/mobile-mri2.jpg",
    alt: "Mobile imaging trailer exterior",
    category: "Exterior",
  },
];

const thumbnailCategories = ["Exterior", "Interior"];

const buildThumbnailGroups = (slides) =>
  thumbnailCategories.map((category) => ({
    category,
    slides: slides
      .map((slide, index) => ({ ...slide, index }))
      .filter((slide) => slide.category === category),
  }));

export default function TrailerImageCarousel({ title, slides = [] }) {
  const trailerSlides = slides.length > 0 ? slides : fallbackSlides;
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying || trailerSlides.length < 2) return undefined;

    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % trailerSlides.length);
    }, 4500);

    return () => window.clearInterval(interval);
  }, [isAutoPlaying, trailerSlides.length]);

  const showSlide = (index) => {
    setActiveIndex(index);
    setIsAutoPlaying(false);
  };

  const thumbnailGroups = buildThumbnailGroups(trailerSlides);
  const activeSlide = trailerSlides[activeIndex];

  return (
    <figure className={`${styles.figure} ${styles.carouselFigure}`}>
      <div className={styles.carouselFrame}>
        {trailerSlides.map((slide, index) => (
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
        <span className={styles.carouselCategoryBadge}>{activeSlide.category}</span>
      </div>
      {trailerSlides.length > 1 && (
        <div className={styles.carouselDots} aria-label="Trailer image carousel controls">
          {trailerSlides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              aria-label={`Show trailer image ${index + 1}`}
              aria-pressed={index === activeIndex}
              onClick={() => showSlide(index)}
              className={index === activeIndex ? styles.carouselDotActive : ""}
            />
          ))}
        </div>
      )}
      <div className={styles.carouselGalleryStatus} aria-live="polite">
        <span>{trailerSlides.length} images</span>
      </div>
      <div className={styles.carouselThumbTable} aria-label="Trailer image thumbnails">
        {thumbnailGroups.map((group) => (
          <section key={group.category} className={styles.carouselThumbSection}>
            <h3>{group.category}</h3>
            {group.slides.length > 0 ? (
              <div className={styles.carouselThumbGrid}>
                {group.slides.map((slide) => (
                  <button
                    key={`${slide.id}-thumbnail`}
                    type="button"
                    aria-label={`View ${slide.category.toLowerCase()} trailer image`}
                    aria-current={slide.index === activeIndex ? "true" : undefined}
                    onClick={() => showSlide(slide.index)}
                    className={`${styles.carouselThumbButton} ${slide.index === activeIndex ? styles.carouselThumbActive : ""}`}
                  >
                    <span className={styles.carouselThumbImage}>
                      <Image src={slide.src} alt="" aria-hidden="true" fill sizes="120px" />
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className={styles.carouselThumbEmpty}>No images in this section.</p>
            )}
          </section>
        ))}
      </div>
    </figure>
  );
}
