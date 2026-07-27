import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

const MAX_RESOLVED_IMAGES = 250;
const resolvedImageUrls = new Map();

const normalizeImagePath = (imagePath) =>
    typeof imagePath === 'string' ? imagePath.trim() : '';

const storageBucket =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'magmo-ac10c.appspot.com';

export const getImageUrl = async (imagePath) => {
    const normalizedPath = normalizeImagePath(imagePath);
    if (!normalizedPath) return null;

    return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(storageBucket)}/o/${encodeURIComponent(normalizedPath)}?alt=media`;
};

const DIRECT_IMAGE_RE = /^(?:https?:|data:|blob:)/i;
const IMAGE_EXTENSION_RE = /\.(?:avif|gif|jpe?g|png|webp)(?:\?.*)?$/i;

export const resolveImageUrl = async (imagePath) => {
    const normalizedPath = normalizeImagePath(imagePath);
    if (!normalizedPath) return null;
    if (DIRECT_IMAGE_RE.test(normalizedPath) || normalizedPath.startsWith('/')) {
      return normalizedPath;
    }

    if (IMAGE_EXTENSION_RE.test(normalizedPath)) {
      return getImageUrl(normalizedPath);
    }

    // Older records omitted the extension. Try one conventional path and let
    // the image element fall back locally if that legacy object does not exist.
    return getImageUrl(`${normalizedPath}.jpg`);
};

const getCachedImageUrl = (imagePath) => {
    const normalizedPath = normalizeImagePath(imagePath);
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

export const getPrimaryImagePath = (product) => {
    const images = Array.isArray(product?.Images)
      ? product.Images.map(normalizeImagePath).filter(Boolean)
      : [];
    const imagePaths = Array.isArray(product?.ImagePaths)
      ? product.ImagePaths.map(normalizeImagePath).filter(Boolean)
      : [];
    const primaryImage = normalizeImagePath(product?.PrimaryImage);
    const productId = normalizeImagePath(product?.id);

    return primaryImage || images[0] || imagePaths[0] ||
      (productId ? `Parts/${productId}/${productId}` : '');
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
 
