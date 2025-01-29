// TestImage.js
import React, { useEffect, useState } from "react";
import { getStorage, ref, getDownloadURL } from "firebase/storage";
import firebase from "../../context/Firebase"; // Adjust the path as needed

const getImageUrl = async (imagePath) => {
  const storage = getStorage(firebase.app());
  const storageRef = ref(storage, imagePath);
  try {
    const url = await getDownloadURL(storageRef);
    return url;
  } catch (error) {
    console.error("Error fetching image URL: ", error);
    return null;
  }
};

const ImageComponent = ({ imagePath }) => {
  const [imageUrl, setImageUrl] = useState(null);

  useEffect(() => {
    const fetchImageUrl = async () => {
      const url = await getImageUrl(imagePath);
      setImageUrl(url);
    };

    fetchImageUrl();
  }, [imagePath]);

  return (
    <div>
      {imageUrl ? <img src={imageUrl} alt="Image" /> : <p>Loading image...</p>}
    </div>
  );
};

const Page = () => {
  return (
    <div>
      <h1>Image from Firebase Storage</h1>
      <ImageComponent imagePath="Parts/AIS12345/AIS12345.png" />
    </div>
  );
};

export default Page;
