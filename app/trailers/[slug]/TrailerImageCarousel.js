"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import styles from "@/app/services/landingPage.module.scss";
const fallbackSlides = [
  {
    src: "/assets/images/interior-1.avif",
    alt: "Mobile MRI trailer interior exam room",
    category: "Interior",
  },
  {
    src: "/assets/images/interior-2.webp",
    alt: "Mobile MRI trailer interior floor plan",
    category: "Interior",
  },
  {
    src: "/assets/images/exterior-1.jpg",
    alt: "Mobile MRI trailer exterior side view",
    category: "Exterior",
  },
  {
    src: "/assets/images/mobile-mri.jpg",
    alt: "Mobile MRI trailer interior cutaway layout",
    category: "Interior",
  },
  {
    src: "/assets/images/mobile-mri2.jpg",
    alt: "Mobile imaging trailer exterior",
    category: "Exterior",
  },
];

const imageExtensions = ["jpg", "jpeg", "png", "webp", "avif"];
const optionalImageNames = [
  ["Exterior", "trailer-exterior", "Mobile MRI trailer exterior"],
  ["Exterior", "exterior", "Mobile MRI trailer exterior side view"],
  ["Exterior", "exterior-1", "Mobile MRI trailer exterior side view"],
  ["Exterior", "mobile-mri-exterior", "Mobile MRI trailer exterior"],
  ["Interior", "trailer-interior", "Mobile MRI trailer interior"],
  ["Interior", "interior", "Mobile MRI trailer interior layout"],
  ["Interior", "interior-1", "Mobile MRI trailer interior exam room"],
  ["Interior", "interior-2", "Mobile MRI trailer interior floor plan"],
  ["Interior", "mobile-mri-interior", "Mobile MRI trailer interior"],
];

const optionalSlides = optionalImageNames.flatMap(([category, fileName, alt]) =>
  imageExtensions.map((extension) => ({
    src: `/assets/images/${fileName}.${extension}`,
    alt,
    category,
  }))
);

const buildThumbnailGroups = (slides) =>
  ["Exterior", "Interior"].map((category) => ({
    category,
    slides: slides
      .map((slide, index) => ({ ...slide, index }))
      .filter((slide) => slide.category === category),
  }));

export default function TrailerImageCarousel({ title }) {
  const [trailerSlides, setTrailerSlides] = useState(fallbackSlides);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    let isMounted = true;

    Promise.all(
      optionalSlides.map(
        (slide) =>
          new Promise((resolve) => {
            const image = new window.Image();
            image.onload = () => resolve(slide);
            image.onerror = () => resolve(null);
            image.src = slide.src;
          })
      )
    ).then((loadedSlides) => {
      if (!isMounted) return;

      const availableSlides = loadedSlides.filter(Boolean);
      if (availableSlides.length > 0) {
        const slidesBySource = new Map(
          [...fallbackSlides, ...availableSlides].map((slide) => [slide.src, slide])
        );
        setTrailerSlides([...slidesBySource.values()]);
        setActiveIndex(0);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isAutoPlaying) return undefined;

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

  return (
    <figure className={`${styles.figure} ${styles.carouselFigure}`}>
      <div className={styles.carouselFrame}>
        {trailerSlides.map((slide, index) => (
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
      <div className={styles.carouselDots} aria-label="Trailer image carousel controls">
        {trailerSlides.map((slide, index) => (
          <button
            key={slide.alt}
            type="button"
            aria-label={`Show trailer image ${index + 1}`}
            aria-pressed={index === activeIndex}
            onClick={() => showSlide(index)}
            className={index === activeIndex ? styles.carouselDotActive : ""}
          />
        ))}
      </div>
      <div className={styles.carouselThumbTable} aria-label="Trailer image thumbnails">
        {thumbnailGroups.map((group) => (
          <section key={group.category} className={styles.carouselThumbSection}>
            <h3>{group.category}</h3>
            <div className={styles.carouselThumbGrid}>
              {group.slides.map((slide) => (
                <button
                  key={`${slide.alt}-thumbnail`}
                  type="button"
                  aria-label={`View ${slide.category.toLowerCase()} trailer image`}
                  aria-current={slide.index === activeIndex ? "true" : undefined}
                  onClick={() => showSlide(slide.index)}
                  className={slide.index === activeIndex ? styles.carouselThumbActive : ""}
                >
                  <span className={styles.carouselThumbImage}>
                    <Image src={slide.src} alt="" aria-hidden="true" fill sizes="120px" />
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </figure>
  );
}
