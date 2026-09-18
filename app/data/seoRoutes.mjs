export const PART_CATEGORY_PATHS = [
  "/parts/ge/mri",
  "/parts/ge/ct",
  "/parts/ge/pet-ct",
  "/parts/siemens/mri",
  "/parts/siemens/ct",
  "/parts/siemens/pet-ct",
  "/parts/toshiba/mri",
  "/parts/toshiba/ct",
  "/parts/philips/mri",
  "/parts/philips/ct",
  "/parts/philips/pet-ct",
];

export const CORE_SITEMAP_ENTRIES = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/parts", changeFrequency: "weekly", priority: 0.8 },
  { path: "/services", changeFrequency: "weekly", priority: 0.9 },
  { path: "/about", changeFrequency: "monthly", priority: 0.6 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.6 },
  { path: "/trailers", changeFrequency: "weekly", priority: 0.85 },
  ...PART_CATEGORY_PATHS.map((path) => ({
    path,
    changeFrequency: "weekly",
    priority: 0.76,
  })),
];

export const SITEMAP_PATHS = [
  "/sitemaps/core/sitemap.xml",
  "/sitemaps/services/sitemap.xml",
  "/sitemaps/trailers/sitemap.xml",
  "/sitemaps/products/sitemap.xml",
];

export const LEGACY_TRAILER_REDIRECTS = [
  ["/mobile-mri-and-ct-trailer-rentals", "/trailers"],
  ["/services/mobile-mri-trailer-rental", "/trailers/mobile-mri-trailer-rental"],
  ["/services/mobile-ct-trailer-rental", "/trailers/mobile-ct-trailer-rental"],
  ["/services/mobile-pet-ct-trailer", "/trailers/mobile-pet-ct-trailer-rental"],
].map(([source, destination]) => ({ source, destination, permanent: true }));
