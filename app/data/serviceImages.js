const mriServiceImages = [
  {
    id: "MRI-1",
    src: "/assets/images/services/MRI-1.webp",
    alt: "MRI scanner and patient table in a clinical imaging room",
  },
  {
    id: "MRI-2",
    src: "/assets/images/services/MRI-2.webp",
    alt: "MRI scanner bore and patient table in a bright imaging suite",
  },
  {
    id: "MRI-3",
    src: "/assets/images/services/MRI-3.webp",
    alt: "MRI system and patient table in a hospital scan room",
  },
];

const ctServiceImagesByBrand = {
  GE: [
    {
      id: "GE-CT-1",
      src: "/assets/images/services/GE-CT-1.webp",
      alt: "GE CT scanner with technologist and patient",
    },
  ],
  Siemens: [
    {
      id: "Siemens-CT-1",
      src: "/assets/images/services/Siemens-CT-1.webp",
      alt: "Siemens CT scanner and patient table in an imaging suite",
    },
  ],
  Toshiba: [
    {
      id: "Toshiba-CT-1",
      src: "/assets/images/services/Toshiba-CT-1.webp",
      alt: "Toshiba CT scanner and patient table in a clinical scan room",
    },
    {
      id: "Toshiba-CT-2",
      src: "/assets/images/services/Toshiba-CT-2.webp",
      alt: "Toshiba CT scanner with technologist and patient",
    },
  ],
};

const ctServiceImages = Object.values(ctServiceImagesByBrand).flat();

export const getServiceImages = ({ brand, modality }) => {
  if (modality === "mri") return mriServiceImages;

  if (modality === "ct" && brand && ctServiceImagesByBrand[brand]) {
    return ctServiceImagesByBrand[brand];
  }

  return ctServiceImages;
};
