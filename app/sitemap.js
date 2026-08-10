import { BASE_URL } from "@/app/data/seoProducts";

const partsCategoryPaths = [
  "ge/mri",
  "ge/ct",
  "ge/pet-ct",
  "siemens/mri",
  "siemens/ct",
  "siemens/pet-ct",
  "toshiba/mri",
  "toshiba/ct",
  "philips/mri",
  "philips/ct",
  "philips/pet-ct",
];

export default async function sitemap() {
  const urls = [
    {
      url: BASE_URL,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/parts`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/services`,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/service-request`,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/about`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/contact`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/trailers`,
      changeFrequency: "weekly",
      priority: 0.85,
    },
  ];

  for (const path of partsCategoryPaths) {
    urls.push({
      url: `${BASE_URL}/parts/${path}`,
      changeFrequency: "weekly",
      priority: 0.76,
    });
  }

  return urls;
}
