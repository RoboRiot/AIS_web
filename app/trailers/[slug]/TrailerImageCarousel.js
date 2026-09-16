"use client";

import { useState } from "react";
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

export default function TrailerImageCarousel({ title, slides = [], priority = true }) {
  const trailerSlides = slides.length > 0 ? slides : fallbackSlides;
  const [activeIndex, setActiveIndex] = useState(0);

  const showSlide = (index) => {
    setActiveIndex(index);
  };

  const thumbnailGroups = buildThumbnailGroups(trailerSlides);
  const activeSlide = trailerSlides[activeIndex];

  return (
    <figure className={`${styles.figure} ${styles.carouselFigure}`}>
      <div className={styles.carouselFrame}>
        <Image
          key={activeSlide.id}
          src={activeSlide.src}
          alt={`${title}: ${activeSlide.alt}`}
          fill
          priority={priority && activeIndex === 0}
          sizes="(max-width: 1100px) 100vw, 45vw"
          className={styles.carouselActive}
        />
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
      <details className={styles.trailerGalleryDetails}>
        <summary>Exterior and interior photos ({trailerSlides.length})</summary>
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
                    aria-label={`View ${slide.category.toLowerCase()} trailer image ${slide.index + 1}`}
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
      </details>
    </figure>
  );
}
