const navigationBrands = ["GE", "Siemens", "Toshiba"];

export const navigationModalities = {
  mri: "MRI",
  ct: "CT",
  "pet-ct": "PET/CT",
};

const slugFor = (brand, modality, suffix) =>
  `${brand.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${modality}-${suffix}`;

export const serviceNavigationLinks = Object.entries(navigationModalities).flatMap(
  ([modality, label]) => [
    {
      slug: `${modality}-service`,
      brand: null,
      modality,
      shortTitle: `${label} Service`,
    },
    ...navigationBrands.map((brand) => ({
      slug: slugFor(brand, modality, "service"),
      brand,
      modality,
      shortTitle: `${brand} ${label} Service`,
    })),
  ],
);

export const trailerNavigationLinks = Object.entries(navigationModalities).flatMap(
  ([modality, label]) => [
    {
      slug: `mobile-${modality}-trailer-rental`,
      brand: null,
      modality,
      shortTitle: `Mobile ${label} Trailer Rental`,
    },
    ...navigationBrands.map((brand) => ({
      slug: slugFor(brand, modality, "trailer-rental"),
      brand,
      modality,
      shortTitle: `${brand} Mobile ${label} Trailer`,
    })),
  ],
);
