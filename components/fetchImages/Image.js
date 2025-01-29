import { getStorage, ref, getDownloadURL } from "firebase/storage";
import {Firebase} from '@/firebase/Firebase';
import React, { useState, useEffect } from 'react';
import Image from 'next/image';



export const getImageUrl = async (imagePath) => {
    const storage = getStorage(Firebase.app());

    const storageRef = ref(storage, imagePath);
    try {

      const url = await getDownloadURL(storageRef);      
      return url;
    } catch (error) {
      console.error("Error fetching image URL: ", error);
      return 0;
    }
  };
  
  export const ImageComponent = ({ imagePath }) => {
    const [imageUrl, setImageUrl] = useState(null);
  
    useEffect(() => {
      const fetchImageUrl = async () => {
      const imageType = ['.png', '.jpg', '.jpeg','JPEG','JPG'];

        const processImageUrls = async () => {
          for (const x of imageType) {
              const url = await getImageUrl(imagePath + x);
              if (url) {
                  setImageUrl(url);
                  break; // Exit the loop as soon as the condition is met
              }
            }
        };
        
        processImageUrls();

      };
  
      fetchImageUrl();
    }, [imagePath]);
  
    return (
      <div>
        {/* {imageUrl ? <img src={imageUrl} alt="Image"/> : <p>Loading image...</p>} */}
        <Image width={470} height={320} alt="image" src={imageUrl  ? imageUrl : '/assets/images/slide1.png' } />
      </div>
    );
  };
 