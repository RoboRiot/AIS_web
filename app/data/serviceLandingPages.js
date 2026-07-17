export const serviceBrands = ["GE", "Siemens", "Toshiba"];

export const serviceModalities = {
  mri: {
    label: "MRI",
    serviceLabel: "MRI Service",
    pageTitle: "MRI Service",
    description:
      "MRI maintenance, diagnostics, repair, preventive maintenance, coil support, RF and gradient-related troubleshooting, parts coordination, and emergency response for hospitals and imaging centers.",
    systems: [
      "GE Signa and Discovery MRI",
      "Siemens MAGNETOM MRI",
      "Toshiba/Canon Vantage MRI",
      "Hospital and outpatient MRI suites",
    ],
    servicePoints: [
      "MRI preventive maintenance and repair",
      "System diagnostics and image-quality troubleshooting",
      "MRI coil, RF, gradient, and power support coordination",
      "Tested replacement parts and downtime planning",
    ],
  },
  ct: {
    label: "CT",
    serviceLabel: "CT Service",
    pageTitle: "CT Scanner Service",
    description:
      "CT scanner service, repair, preventive maintenance, calibration support, CT tube coordination, detector support, board replacement, emergency troubleshooting, and tested parts sourcing.",
    systems: [
      "GE Discovery, LightSpeed, Revolution, and Optima CT",
      "Siemens SOMATOM CT",
      "Toshiba/Canon Aquilion CT",
      "Hospital and outpatient CT scanners",
    ],
    servicePoints: [
      "CT preventive maintenance and emergency repair",
      "CT tube, detector, and data-acquisition support",
      "Calibration, system diagnostics, and uptime planning",
      "Replacement parts support for high-volume imaging departments",
    ],
  },
  "pet-ct": {
    label: "PET/CT",
    serviceLabel: "PET/CT Service",
    pageTitle: "PET/CT Service",
    description:
      "PET/CT service support for oncology and diagnostic imaging providers, including uptime planning, troubleshooting, and tested parts coordination.",
    systems: [
      "GE Discovery PET/CT",
      "Siemens Biograph PET/CT",
      "Toshiba/Canon PET/CT workflows",
      "Oncology and diagnostic PET/CT programs",
    ],
    servicePoints: [
      "PET/CT preventive maintenance and service planning",
      "Emergency troubleshooting for uptime-sensitive oncology imaging",
      "PET/CT diagnostics and service coordination",
      "Parts sourcing and compatibility support",
    ],
  },
};

const geMriModelCoverage = [
  {
    category: "GE 1.5T MRI platforms",
    summary: "Core GE 1.5T systems commonly searched for mobile MRI rental, lease coverage, replacement planning, and service support.",
    models: [
      { name: "Signa Artist 1.5T", aliases: ["Platform and legacy configurations"] },
      { name: "Signa Artist Evo 1.5T" },
      { name: "Optima MR450w 1.5T" },
      { name: "Signa Voyager 1.5T", aliases: ["Classic enclosure"] },
      { name: "Signa Creator / Signa Explorer 1.5T" },
      { name: "Signa Champion 1.5T" },
      { name: "Signa Prime 1.5T" },
      { name: "Signa Victor 1.5T" },
      { name: "Signa Sprint Select 1.5T", aliases: ["Freelium option"] },
      { name: "Signa Sprint Elite 1.5T" },
    ],
  },
  {
    category: "GE 3.0T MRI platforms",
    summary: "GE 3.0T MRI models and platform names buyers use when searching for service, repair, preventive maintenance, and parts support.",
    models: [
      { name: "Signa Architect 3.0T", aliases: ["Discovery MR750w"] },
      { name: "Signa Premier 3.0T", aliases: ["Site neutral configuration"] },
      { name: "Signa Premier XT 3.0T" },
      { name: "Signa Pioneer 3.0T" },
      { name: "Signa Hero 3.0T" },
      { name: "Signa Bolt 3.0T" },
      { name: "Signa PET-MR 3.0T", aliases: ["UA magnet", "AR magnet"] },
    ],
  },
  {
    category: "Advanced GE MRI platform",
    summary: "Specialty GE MRI platform support for facilities planning equipment transitions, service coverage, or replacement strategy.",
    models: [{ name: "Signa 7T" }],
  },
];

const geMriTrailerModelCoverage = geMriModelCoverage.slice(0, 1);

const geMriServiceModelKeywords = geMriModelCoverage.flatMap((group) =>
  group.models.flatMap((model) => [
    model.name,
    ...(model.aliases || []).map((alias) => `${model.name} ${alias}`),
    `${model.name} service`,
    `${model.name} repair`,
    `${model.name} MRI service`,
  ])
);

const geMriTrailerModelKeywords = geMriTrailerModelCoverage.flatMap((group) =>
  group.models.flatMap((model) => [
    model.name,
    ...(model.aliases || []).map((alias) => `${model.name} ${alias}`),
    `${model.name} mobile MRI trailer`,
    `${model.name} mobile MRI rental`,
  ])
);

const siemensMriModelCoverage = [
  {
    category: "Siemens 1.5T MRI platforms",
    summary: "Core Siemens MAGNETOM 1.5T systems commonly searched for mobile MRI rental, replacement coverage, service, repair, and parts support.",
    models: [
      { name: "MAGNETOM Aera 1.5T", aliases: ["Aera XJ gradients", "Aera XQ gradients", "Aera Mobile"] },
      { name: "MAGNETOM Sola 1.5T", aliases: ["Sola XJ gradients", "Sola XQ gradients", "Sola Fit upgrade"] },
      { name: "MAGNETOM Altea 1.5T" },
      { name: "MAGNETOM Amira 1.5T" },
      { name: "MAGNETOM Avanto 1.5T", aliases: ["Avanto Fit upgrade", "Avanto Mobile"] },
      { name: "MAGNETOM Espree 1.5T", aliases: ["Espree Mobile"] },
      { name: "MAGNETOM Sempra 1.5T" },
      { name: "MAGNETOM Essenza 1.5T" },
      { name: "MAGNETOM Symphony 1.5T", aliases: ["Symphony Mobile", "Symphony TIM upgrade", "MAGNETOM Harmony Mobile"] },
      { name: "MAGNETOM Viato.Mobile 1.5T" },
      { name: "MAGNETOM Flow 60 1.5T" },
      { name: "MAGNETOM Flow 70 1.5T" },
    ],
  },
  {
    category: "Siemens 3T MRI platforms",
    summary: "Siemens 3T systems and platform names buyers use when searching for MRI service, repair, preventive maintenance, and parts support.",
    models: [
      { name: "MAGNETOM Vida 3T", aliases: ["Vida XQ gradients", "Vida XT gradients", "Vida Fit upgrade"] },
      { name: "MAGNETOM Skyra 3T", aliases: ["Skyra Fit upgrade"] },
      { name: "MAGNETOM Prisma 3T", aliases: ["Prisma Fit upgrade"] },
      { name: "MAGNETOM Lumina 3T" },
      { name: "MAGNETOM Cima.X 3T" },
      { name: "MAGNETOM Spectra 3T" },
      { name: "MAGNETOM Verio 3T" },
      { name: "MAGNETOM Trio 3T", aliases: ["Trio TIM"] },
      { name: "Biograph mMR 3T" },
      { name: "Biograph One 3T" },
    ],
  },
  {
    category: "Siemens advanced MRI platforms",
    summary: "Specialty Siemens MRI platforms for service conversations, replacement planning, and installed-base support.",
    models: [
      { name: "MAGNETOM Terra 7T" },
      { name: "MAGNETOM Terra.X 7T" },
      { name: "MAGNETOM Free.Max 0.55T" },
      { name: "MAGNETOM Free.Star 0.55T" },
      { name: "MAGNETOM C! 0.35T" },
    ],
  },
];

const siemensMriTrailerModelCoverage = [
  {
    category: "Siemens 1.5T mobile MRI platforms",
    summary: "Siemens 1.5T MAGNETOM systems commonly searched for mobile MRI trailer rental, lease coverage, and mobile service planning.",
    models: [
      { name: "MAGNETOM Aera Mobile 1.5T", aliases: ["MAGNETOM Aera 1.5T"] },
      { name: "MAGNETOM Viato.Mobile 1.5T" },
      { name: "MAGNETOM Avanto Mobile 1.5T", aliases: ["MAGNETOM Avanto 1.5T"] },
      { name: "MAGNETOM Espree Mobile 1.5T", aliases: ["MAGNETOM Espree 1.5T"] },
      { name: "MAGNETOM Symphony Mobile 1.5T", aliases: ["MAGNETOM Symphony 1.5T"] },
      { name: "MAGNETOM Symphony / Harmony Mobile 1.5T" },
    ],
  },
];

const siemensMriServiceModelKeywords = siemensMriModelCoverage.flatMap((group) =>
  group.models.flatMap((model) => [
    model.name,
    ...(model.aliases || []).map((alias) => `${model.name} ${alias}`),
    `${model.name} service`,
    `${model.name} repair`,
    `${model.name} MRI service`,
  ])
);

const siemensMriTrailerModelKeywords = siemensMriTrailerModelCoverage.flatMap((group) =>
  group.models.flatMap((model) => [
    model.name,
    ...(model.aliases || []).map((alias) => `${model.name} ${alias}`),
    `${model.name} mobile MRI trailer`,
    `${model.name} mobile MRI rental`,
  ])
);

const mriServiceModelCoverage = {
  GE: geMriModelCoverage,
  Siemens: siemensMriModelCoverage,
};

const mriTrailerModelCoverage = {
  GE: geMriTrailerModelCoverage,
  Siemens: siemensMriTrailerModelCoverage,
};

const mriServiceModelKeywords = {
  GE: geMriServiceModelKeywords,
  Siemens: siemensMriServiceModelKeywords,
};

const mriTrailerModelKeywords = {
  GE: geMriTrailerModelKeywords,
  Siemens: siemensMriTrailerModelKeywords,
};

const getModelCoverage = (brand, modality) =>
  modality === "mri" ? mriServiceModelCoverage[brand] || null : null;

const getTrailerModelCoverage = (brand, modality) =>
  modality === "mri" ? mriTrailerModelCoverage[brand] || null : null;

const getServiceModelKeywords = (brand, modality) =>
  modality === "mri" ? mriServiceModelKeywords[brand] || [] : [];

const getTrailerModelKeywords = (brand, modality) =>
  modality === "mri" ? mriTrailerModelKeywords[brand] || [] : [];

const brandSystems = {
  GE: {
    mri: ["Optima MR450w 1.5T", "SIGNA Voyager 1.5T", "SIGNA Artist 1.5T", "SIGNA Architect 3.0T", "SIGNA Premier 3.0T", "Discovery MR750w 3.0T"],
    ct: ["Discovery CT750 HD", "LightSpeed", "BrightSpeed", "Revolution CT", "Optima CT660", "Discovery 4 PET"],
    "pet-ct": ["Discovery PET/CT", "Discovery MI", "Discovery IQ", "Discovery 4 PET"],
  },
  Siemens: {
    mri: ["MAGNETOM Aera 1.5T", "MAGNETOM Sola 1.5T", "MAGNETOM Avanto 1.5T", "MAGNETOM Skyra 3T", "MAGNETOM Vida 3T", "MAGNETOM Prisma 3T"],
    ct: ["SOMATOM Force", "SOMATOM Definition AS", "SOMATOM Definition Edge", "SOMATOM Drive", "SOMATOM Perspective", "SOMATOM Emotion"],
    "pet-ct": ["Biograph mCT", "Biograph Vision", "Biograph Horizon", "Biograph PET/CT clinical environments"],
  },
  Toshiba: {
    mri: ["Vantage Titan", "Vantage Orian", "Vantage Galan", "Vantage Elan", "Vantage Atlas", "Excelart Vantage XGV"],
    ct: ["Aquilion ONE", "Aquilion Prime", "Aquilion 64", "Aquilion Lightning", "Aquilion Precision", "Aquilion CXL"],
    "pet-ct": ["Canon/Toshiba PET/CT service workflows", "Celesteion PET/CT", "Aquilion-based PET/CT support"],
  },
};

const trailerBrandSystems = {
  GE: {
    mri: ["Optima MR450w 1.5T", "SIGNA Voyager 1.5T", "SIGNA Artist 1.5T", "SIGNA Creator / Explorer 1.5T", "SIGNA Prime 1.5T", "SIGNA Victor 1.5T"],
  },
  Siemens: {
    mri: ["MAGNETOM Aera Mobile 1.5T", "MAGNETOM Viato.Mobile 1.5T", "MAGNETOM Avanto Mobile 1.5T", "MAGNETOM Espree Mobile 1.5T", "MAGNETOM Symphony Mobile 1.5T", "MAGNETOM Sola 1.5T"],
  },
};

const getTrailerSystems = (brand, modality) =>
  trailerBrandSystems[brand]?.[modality] || brandSystems[brand][modality];

const brandDescriptions = {
  GE: "GE imaging teams often need fast diagnostics, practical parts support, and a service partner who understands scanner uptime.",
  Siemens: "Siemens imaging environments require careful service planning, clear communication, and engineers familiar with MAGNETOM, SOMATOM, and Biograph workflows.",
  Toshiba: "Toshiba and Canon imaging systems are supported with service planning, troubleshooting, parts coordination, and practical uptime support for MRI, CT, and PET/CT workflows.",
};

const slugFor = (brand, modality, suffix) =>
  `${brand.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${modality}-${suffix}`;

const genericServicePages = Object.entries(serviceModalities).map(([modality, config]) => ({
  slug: `${modality}-service`,
  brand: null,
  modality,
  title: `${config.pageTitle} | Advanced Imaging Services`,
  shortTitle: config.serviceLabel,
  eyebrow: "Multi-vendor service",
  h1: config.pageTitle,
  description: `Advanced Imaging Services provides nationwide ${config.serviceLabel.toLowerCase()}, preventive maintenance, emergency repair, troubleshooting, and tested parts support.`,
  intro: config.description,
  systems: config.systems,
  servicePoints: config.servicePoints,
  keywords: [
    `${config.label} service`,
    `${config.label} repair`,
    `${config.label} preventive maintenance`,
    `${config.label} emergency service`,
    `medical imaging ${config.label} service`,
  ],
}));

const brandServicePages = serviceBrands.flatMap((brand) =>
  Object.entries(serviceModalities).map(([modality, config]) => ({
    slug: slugFor(brand, modality, "service"),
    brand,
    modality,
    title: `${brand} ${config.serviceLabel} | Advanced Imaging Services`,
    shortTitle: `${brand} ${config.serviceLabel}`,
    eyebrow: `${brand} ${config.label} support`,
    h1: `${brand} ${config.serviceLabel}`,
    description: `Advanced Imaging Services provides ${brand} ${config.serviceLabel.toLowerCase()}, preventive maintenance, emergency repair, troubleshooting, and tested parts support for hospitals and imaging centers.`,
    intro: `${brandDescriptions[brand]} We support ${brand} ${config.label} service needs with preventive maintenance, emergency troubleshooting, system diagnostics, and tested parts coordination.`,
    systems: brandSystems[brand][modality],
    modelCoverage: getModelCoverage(brand, modality),
    servicePoints: config.servicePoints,
    keywords: [
      `${brand} ${config.label} service`,
      `${brand} ${config.label} repair`,
      `${brand} ${config.label} preventive maintenance`,
      `${brand} ${config.label} emergency service`,
      `${brand} medical imaging equipment service`,
      ...getServiceModelKeywords(brand, modality),
    ],
  }))
);

export const serviceLandingPages = [...genericServicePages, ...brandServicePages];

export const trailerLandingPages = [
  ...Object.entries(serviceModalities).map(([modality, config]) => ({
    slug: `mobile-${modality}-trailer-rental`,
    brand: null,
    modality,
    title: `Mobile ${config.label} Trailer Rental & Service | Advanced Imaging Services`,
    shortTitle: `Mobile ${config.label} Trailer Rental`,
    h1: `Mobile ${config.label} Trailer Rental & Service`,
    description: `Mobile ${config.label} trailer rental, short-term lease, long-term lease, trailer service, downtime coverage, renovation coverage, and purchase planning support from Advanced Imaging Services.`,
    intro: `Advanced Imaging Services helps facilities rent, lease, service, and plan mobile ${config.label} trailers for scanner downtime, renovations, replacement projects, overflow volume, rural access, and new program launches.`,
    systems: config.systems,
    rentalPoints: [
      `Short-term and long-term mobile ${config.label} trailer rental`,
      "Interim imaging coverage for downtime, upgrades, and construction",
      "Service-backed rental planning for hospitals and imaging centers",
      "Support for deployment timing, availability, uptime, and parts coordination",
    ],
    keywords: [
      `mobile ${config.label} trailer rental`,
      `mobile ${config.label} rental`,
      `${config.label} trailer rental`,
      `${config.label} trailer service`,
      `mobile ${config.label} scanner rental`,
      `mobile ${config.label} trailer for sale`,
      `short term mobile ${config.label} lease`,
      `long term mobile ${config.label} lease`,
    ],
  })),
  ...serviceBrands.flatMap((brand) =>
    Object.entries(serviceModalities).map(([modality, config]) => ({
      slug: slugFor(brand, modality, "trailer-rental"),
      brand,
      modality,
      title: `${brand} Mobile ${config.label} Trailer Rental & Service | Advanced Imaging Services`,
      shortTitle: `${brand} Mobile ${config.label} Trailer`,
      h1: `${brand} Mobile ${config.label} Trailer Rental & Service`,
      description: `${brand} mobile ${config.label} trailer rental, lease planning, trailer service, downtime coverage, renovation coverage, and purchase planning support from Advanced Imaging Services.`,
      intro: `Facilities searching for ${brand} mobile ${config.label} trailer rental or service usually need fast interim imaging capacity with technical support. Advanced Imaging Services helps plan rental coverage, lease timing, uptime expectations, purchase comparisons, and service support around your clinical schedule.`,
      systems: getTrailerSystems(brand, modality),
      modelCoverage: getTrailerModelCoverage(brand, modality),
      rentalPoints: [
        `${brand} mobile ${config.label} trailer rental and lease planning`,
        "Short-term and long-term interim imaging coverage",
        "Service-backed support for mobile trailer uptime",
        "Availability, deployment, and replacement-part coordination",
      ],
      keywords: [
        `${brand} mobile ${config.label} trailer`,
        `${brand} mobile ${config.label} trailer rental`,
        `${brand} ${config.label} trailer rental`,
        `${brand} ${config.label} trailer service`,
        `${brand} mobile ${config.label} rental`,
        `${brand} mobile ${config.label} trailer for sale`,
        `${brand} ${config.label} mobile unit lease`,
        ...getTrailerModelKeywords(brand, modality),
      ],
    }))
  ),
];

export const getServiceLandingPage = (slug) =>
  serviceLandingPages.find((page) => page.slug === slug);

export const getTrailerLandingPage = (slug) =>
  trailerLandingPages.find((page) => page.slug === slug);
