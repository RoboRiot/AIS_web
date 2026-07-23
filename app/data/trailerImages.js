const createTrailerSlides = (folder, altLabel, fileNames, exteriorFileNames = []) => {
  const exteriorFiles = new Set(exteriorFileNames);

  return fileNames.map((fileName, index) => ({
    id: `${folder}/${fileName}`,
    src: `/assets/images/trailers/${folder}/${fileName}`,
    alt: `${altLabel} ${index + 1}`,
    category: exteriorFiles.has(fileName) ? "Exterior" : "Interior",
  }));
};

const geCtImages = createTrailerSlides(
  "ge-ct",
  "GE mobile CT trailer view",
  [
    "IMG_1549.jpg.webp",
    "IMG_1537.webp",
    "IMG_1539.webp",
    "IMG_1532-rotated.webp",
    "IMG_1551-rotated.webp",
    "IMG_1553-rotated.webp",
    "IMG_1561-rotated.webp",
    "IMG_1566.webp",
    "IMG_1276.webp",
    "IMG_1280.webp",
    "IMG_1281.webp",
    "IMG_1283.webp",
    "IMG_1284.webp",
    "IMG_1286.webp",
    "IMG_1290.webp",
  ],
  ["IMG_1276.webp", "IMG_1280.webp", "IMG_1281.webp", "IMG_1283.webp", "IMG_1284.webp"]
);

const gePetCtImages = createTrailerSlides("ge-pet-ct", "GE mobile PET/CT trailer interior view", [
  "IMG_8610.webp",
  "Scan-Room--rotated.webp",
]);

const siemensPetCtImages = createTrailerSlides(
  "siemens-pet-ct",
  "Siemens Biograph mobile PET/CT trailer interior view",
  [
    "AMST-Siemens-Biograph-Vision-Control-Scan2.webp",
    "AMST-Siemens-Biograph-Vision-Scan-Room2.webp",
  ]
);

const geMriImages = createTrailerSlides("ge-mri", "GE SIGNA Voyager mobile MRI trailer interior view", [
  "GE-SIGNA-Voyager-MRI_Voyager-MRI.webp",
  "GE-SIGNA-Voyager-MRI_Scan-Room.webp",
  "GE-SIGNA-Voyager-MRI_Scan-Room-RSNA-18.webp",
  "GE-SIGNA-Voyager-MRI_Looking-into-scan-room.webp",
  "GE-SIGNA-Voyager-MRI_Interior.webp",
  "GE-SIGNA-Voyager-MRI_Control-Room-into-scan-room.webp",
  "GE-SIGNA-Voyager-MRI_16-1198-15_2530.webp",
  "GE-SIGNA-Voyager-MRI_16-1198-15_2497.webp",
  "GE-SIGNA-Voyager-MRI_16-1198-15_2482.webp",
]);

const siemensMriImages = createTrailerSlides(
  "siemens-mri",
  "Siemens MAGNETOM Viato mobile MRI trailer view",
  [
    "Siemens-MRI-Viato-04122024_140123.webp",
    "Siemens-MRI-Viato-04122024_140156.webp",
    "Siemens-MRI-Viato-04122024_140213.webp",
    "Siemens-MRI-Viato-04122024_140226.webp",
    "Siemens-MRI-Viato-04122024_140244.webp",
  ],
  ["Siemens-MRI-Viato-04122024_140123.webp"]
);

const canonCtImages = createTrailerSlides("canon-ct", "Canon mobile CT trailer interior view", [
  "Mobile-CT-Canon-interior-6.webp",
  "Mobile-CT-Canon-interior-8.webp",
  "Mobile-CT-Canon-interior-12.webp",
  "Mobile-CT-Canon-interior-14.webp",
  "Mobile-CT-Canon-interior-17.webp",
  "Mobile-CT-Canon-interior-23.webp",
  "Mobile-CT-Canon-interior-26.webp",
]);

const siemensCtImages = createTrailerSlides("siemens-ct", "Siemens mobile CT trailer interior view", [
  "Mobile-CT-Siemens-interior-2.webp",
  "Mobile-CT-Siemens-interior-3.webp",
  "Mobile-CT-Siemens-interior-4.webp",
  "Mobile-CT-Siemens-interior-5.webp",
  "Mobile-CT-Siemens-interior-7.webp",
  "Mobile-CT-Siemens-interior-8.webp",
  "Mobile-CT-Siemens-interior-12.webp",
]);

const genericMriExteriorImages = [
  {
    id: "generic-mri/exterior-1.jpg",
    src: "/assets/images/exterior-1.jpg",
    alt: "Generic mobile MRI trailer exterior side view",
    category: "Exterior",
  },
  {
    id: "generic-mri/mobile-mri2.jpg",
    src: "/assets/images/mobile-mri2.jpg",
    alt: "Generic mobile MRI trailer exterior equipment view",
    category: "Exterior",
  },
];

const genericTrailerExteriorImage = {
  id: "generic/exterior-2.webp",
  src: "/assets/images/trailers/generic/exterior-2.webp",
  alt: "Mobile imaging trailer exterior side view",
  category: "Exterior",
};

const openRollupDoorImages = new Set(["ge-ct/IMG_1283.webp", "ge-ct/IMG_1284.webp"]);
const reusableGeCtImages = geCtImages.filter((image) => !openRollupDoorImages.has(image.id));
const reusableGeCtExteriorImages = reusableGeCtImages
  .filter((image) => image.category === "Exterior")
  .map((image, index) => ({
    ...image,
    alt: `Mobile imaging trailer exterior view ${index + 1}`,
  }));

const selectTrailerImages = (images, ids, altLabel) => {
  const imagesById = new Map(images.map((image) => [image.id, image]));

  return ids.map((id, index) => {
    const image = imagesById.get(id);
    if (!image) throw new Error(`Missing curated trailer image: ${id}`);

    return {
      ...image,
      alt: `${altLabel} ${index + 1}`,
    };
  });
};

const generalMriExteriorImages = selectTrailerImages(
  [...genericMriExteriorImages, genericTrailerExteriorImage, ...reusableGeCtExteriorImages],
  [
    "generic-mri/exterior-1.jpg",
    "generic-mri/mobile-mri2.jpg",
    "generic/exterior-2.webp",
    "ge-ct/IMG_1280.webp",
  ],
  "Mobile MRI trailer exterior view"
);

const generalMriInteriorImages = selectTrailerImages(
  [...geMriImages, ...siemensMriImages],
  [
    "ge-mri/GE-SIGNA-Voyager-MRI_16-1198-15_2482.webp",
    "ge-mri/GE-SIGNA-Voyager-MRI_Interior.webp",
    "ge-mri/GE-SIGNA-Voyager-MRI_Control-Room-into-scan-room.webp",
    "siemens-mri/Siemens-MRI-Viato-04122024_140213.webp",
    "siemens-mri/Siemens-MRI-Viato-04122024_140244.webp",
  ],
  "Mobile MRI trailer interior view"
);

const generalCtExteriorImages = selectTrailerImages(
  [genericTrailerExteriorImage, ...reusableGeCtExteriorImages],
  [
    "generic/exterior-2.webp",
    "ge-ct/IMG_1276.webp",
    "ge-ct/IMG_1280.webp",
    "ge-ct/IMG_1281.webp",
  ],
  "Mobile CT trailer exterior view"
);

const generalCtInteriorImages = selectTrailerImages(
  [...geCtImages, ...siemensCtImages, ...canonCtImages],
  [
    "ge-ct/IMG_1286.webp",
    "ge-ct/IMG_1549.jpg.webp",
    "siemens-ct/Mobile-CT-Siemens-interior-2.webp",
    "canon-ct/Mobile-CT-Canon-interior-6.webp",
    "canon-ct/Mobile-CT-Canon-interior-26.webp",
  ],
  "Mobile CT trailer interior view"
);

const generalPetCtInteriorImages = selectTrailerImages(
  [...gePetCtImages, ...siemensPetCtImages],
  [
    "ge-pet-ct/IMG_8610.webp",
    "ge-pet-ct/Scan-Room--rotated.webp",
    "siemens-pet-ct/AMST-Siemens-Biograph-Vision-Control-Scan2.webp",
    "siemens-pet-ct/AMST-Siemens-Biograph-Vision-Scan-Room2.webp",
  ],
  "Mobile PET/CT trailer interior view"
);

const trailerImagesBySlug = {
  "mobile-mri-trailer-rental": [...generalMriExteriorImages, ...generalMriInteriorImages],
  "mobile-ct-trailer-rental": [...generalCtExteriorImages, ...generalCtInteriorImages],
  "mobile-pet-ct-trailer-rental": [...generalCtExteriorImages, ...generalPetCtInteriorImages],
  "ge-ct-trailer-rental": geCtImages,
  "ge-pet-ct-trailer-rental": [...reusableGeCtExteriorImages, ...gePetCtImages],
  "siemens-pet-ct-trailer-rental": [...reusableGeCtExteriorImages, ...siemensPetCtImages],
  "ge-mri-trailer-rental": [...genericMriExteriorImages, ...geMriImages],
  "siemens-mri-trailer-rental": siemensMriImages,
  "toshiba-ct-trailer-rental": [...reusableGeCtExteriorImages, ...canonCtImages],
  "siemens-ct-trailer-rental": [...reusableGeCtExteriorImages, ...siemensCtImages],
};

export const getTrailerImages = (slug) => trailerImagesBySlug[slug] || [];
