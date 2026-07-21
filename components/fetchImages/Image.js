import { getStorage, ref, getDownloadURL } from "firebase/storage";
import {Firebase} from '@/firebase/Firebase';
import React, { useState, useEffect } from 'react';
import Image from 'next/image';

export const getImageUrl = async (imagePath) => {
    if (!imagePath) return null;

    const storage = getStorage(Firebase.app());
    const storageRef = ref(storage, imagePath);

    try {
      const url = await getDownloadURL(storageRef);
      return url;
    } catch {
      return null;
    }
};

const DIRECT_IMAGE_RE = /^(?:https?:|data:|blob:)/i;
const IMAGE_EXTENSION_RE = /\.(?:avif|gif|jpe?g|png|webp)(?:\?.*)?$/i;

export const resolveImageUrl = async (imagePath) => {
    if (!imagePath) return null;
    if (DIRECT_IMAGE_RE.test(imagePath) || imagePath.startsWith('/')) return imagePath;

    if (IMAGE_EXTENSION_RE.test(imagePath)) {
      return getImageUrl(imagePath);
    }

    // Older inventory records did not save their extension. Keep a bounded
    // fallback for those records while new catalog entries use exact paths.
    for (const extension of ['.jpg', '.jpeg', '.png']) {
      const url = await getImageUrl(`${imagePath}${extension}`);
      if (url) return url;
    }

    return null;
};

export const getPrimaryImagePath = (product) => {
    const images = Array.isArray(product?.Images) ? product.Images : [];
    const imagePaths = Array.isArray(product?.ImagePaths) ? product.ImagePaths : [];
    return product?.PrimaryImage || images[0] || imagePaths[0] ||
      (product?.id ? `Parts/${product.id}/${product.id}` : '');
};

export const ImageComponent = ({ imagePath, alt = "Medical imaging equipment part image" }) => {
    const [imageUrl, setImageUrl] = useState(null);

    useEffect(() => {
      let active = true;

      const fetchImageUrl = async () => {
        const url = await resolveImageUrl(imagePath);
        if (active) setImageUrl(url);
      };

      fetchImageUrl();

      return () => {
        active = false;
      };
    }, [imagePath]);

    return (
      <div>
        <Image
          width={470}
          height={320}
          alt={alt}
          src={imageUrl || '/assets/images/slide1.png'}
        />
      </div>
    );
};
 
