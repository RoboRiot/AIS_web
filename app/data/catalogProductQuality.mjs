const cleanValue = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const hiddenValues = new Set(["hidden", "private", "draft", "unpublished"]);
const placeholderNames = new Set([
  "image",
  "loading",
  "medical imaging part",
  "n/a",
  "na",
  "part",
  "test",
  "unknown",
]);

const valuesFrom = (value) => {
  if (Array.isArray(value)) return value.flatMap(valuesFrom);
  if (value == null || typeof value === "object") return [];
  return [cleanValue(value)].filter(Boolean);
};

export const cleanCatalogProductName = (product = {}) => {
  const name = cleanValue(product.Name).replace(/\?{2,}/g, " ");
  const suffixMatch = name.match(/^-(\d+)\s+(.+)$/);
  if (!suffixMatch) return cleanValue(name);

  const [, suffix, remainingName] = suffixMatch;
  const partNumbers = [
    ...valuesFrom(product.PN),
    ...valuesFrom(product.AlternatePartNumbers),
  ];
  const suffixBelongsToPartNumber = partNumbers.some((partNumber) =>
    partNumber.toUpperCase().endsWith(`-${suffix.toUpperCase()}`)
  );

  return suffixBelongsToPartNumber ? cleanValue(remainingName) : cleanValue(name);
};

export const cleanCatalogDescription = (value) =>
  cleanValue(value)
    .replace(/\?{2,}/g, " ")
    .replace(/(?:Description:\s*){2,}/gi, "Description: ")
    .replace(/\s+/g, " ")
    .trim();

export const getCatalogImageCandidates = (product = {}) => [
  ...valuesFrom(product.PrimaryImage),
  ...valuesFrom(product.Images),
  ...valuesFrom(product.ImagePaths),
].filter((value) =>
  !/(?:^|\/)(?:loader|loading|slide1|stockimage)(?:[._/-]|$)/i.test(value)
);

export const hasCatalogImage = (product = {}) =>
  getCatalogImageCandidates(product).length > 0;

export const getCampaignReadinessIssues = (product = {}) => {
  const issues = [];
  const name = cleanCatalogProductName(product);
  const normalizedName = name.toLowerCase();
  const visibility = cleanValue(
    product.Visibility || product.Status || product.PublishStatus
  ).toLowerCase();

  if (
    product.Hidden === true ||
    product.WebsiteHidden === true ||
    product.WebsiteVisible === false ||
    product.Published === false ||
    hiddenValues.has(visibility)
  ) {
    issues.push("not-public");
  }
  if (!cleanValue(product.id)) issues.push("missing-id");
  if (name.length < 3 || placeholderNames.has(normalizedName)) {
    issues.push("invalid-name");
  }
  if (!cleanValue(product.PN)) issues.push("missing-part-number");
  if (!cleanValue(product.OEM)) issues.push("missing-oem");
  if (!cleanValue(product.Modality)) issues.push("missing-modality");
  if (!hasCatalogImage(product)) issues.push("missing-image");

  return issues;
};

export const isCampaignReadyProduct = (product = {}) =>
  getCampaignReadinessIssues(product).length === 0;

export const normalizePublicCatalogProduct = (product = {}) => ({
  ...product,
  Name: cleanCatalogProductName(product),
  Description: cleanCatalogDescription(product.Description),
  PN: cleanValue(product.PN),
  OEM: cleanValue(product.OEM),
  Modality: cleanValue(product.Modality),
  Machine: cleanValue(product.Machine),
});
