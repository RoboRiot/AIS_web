"use client";

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
    getImageUrl,
    getPrimaryImagePath,
    resolveImageUrl,
} from '@/app/data/catalogImageUrl.mjs';

export { getImageUrl, getPrimaryImagePath, resolveImageUrl };

const MAX_RESOLVED_IMAGES = 250;
const resolvedImageUrls = new Map();

const getCachedImageUrl = (imagePath) => {
    const normalizedPath = typeof imagePath === 'string' ? imagePath.trim() : '';
    if (!normalizedPath) return Promise.resolve(null);

    if (resolvedImageUrls.has(normalizedPath)) {
      return resolvedImageUrls.get(normalizedPath);
    }

    if (resolvedImageUrls.size >= MAX_RESOLVED_IMAGES) {
      const oldestKey = resolvedImageUrls.keys().next().value;
      resolvedImageUrls.delete(oldestKey);
    }

    const pendingUrl = resolveImageUrl(normalizedPath);
    resolvedImageUrls.set(normalizedPath, pendingUrl);
    return pendingUrl;
};

export const ImageComponent = ({ imagePath, alt = "Medical imaging equipment part image" }) => {
    const [imageUrl, setImageUrl] = useState(null);
    const [shouldResolve, setShouldResolve] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
      setImageUrl(null);
      setShouldResolve(false);

      const container = containerRef.current;
      if (!container || typeof IntersectionObserver === 'undefined') {
        setShouldResolve(true);
        return undefined;
      }

      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldResolve(true);
          observer.disconnect();
        }
      }, { rootMargin: '400px 0px' });

      observer.observe(container);
      return () => observer.disconnect();
    }, [imagePath]);

    useEffect(() => {
      if (!shouldResolve) return undefined;
      let active = true;

      const fetchImageUrl = async () => {
        const url = await getCachedImageUrl(imagePath);
        if (active) setImageUrl(url);
      };

      fetchImageUrl();

      return () => {
        active = false;
      };
    }, [imagePath, shouldResolve]);

    return (
      <div ref={containerRef}>
        <Image
          width={470}
          height={320}
          alt={alt}
          src={imageUrl || '/assets/images/slide1.png'}
          onError={() => setImageUrl(null)}
        />
      </div>
    );
};
 
