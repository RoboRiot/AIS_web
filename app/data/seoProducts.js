export const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://advancedimagingparts.com";

const PRODUCT_CODE_PATTERN = /\b(?=[A-Z0-9-]*[A-Z])(?=[A-Z0-9-]*\d)[A-Z0-9-]{4,}\b/gi;

export const cleanText = (value) => {
  if (!value) return "";
  return value
    .toString()
    .replace(/\?/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export const truncateText = (value, maxLength = 160) => {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength + 1);
  const lastSpace = truncated.lastIndexOf(" ");
  return `${truncated.slice(0, lastSpace > 80 ? lastSpace : maxLength).trim()}...`;
};

export const slugify = (value) => {
  if (!value) return "";
  return value
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export const buildProductSlug = (product) => {
  if (!product) return "";
  const nameSlug = slugify(product.Name);
  const partNumbers = getProductPartNumbers(product).map(slugify).filter(Boolean);
  const idSlug = slugify(product.id);
  const pieces = [nameSlug];

  for (const partNumber of partNumbers.slice(0, 2)) {
    if (partNumber && !nameSlug.includes(partNumber)) pieces.push(partNumber);
  }

  if (idSlug && !pieces.some((piece) => piece === idSlug || piece.includes(idSlug))) {
    pieces.push(idSlug);
  }

  return pieces.filter(Boolean).join("-").slice(0, 140).replace(/-+$/g, "");
};

export const buildProductHref = (product) => {
  const slug = buildProductSlug(product);
  return slug ? `/products/${slug}` : null;
};

export const parseProductSlug = (slug) => {
  if (!slug) return { id: null, nameSlug: "" };
  const nameSlug = slugify(slug);
  const idMatch = nameSlug.match(/(?:^|-)((?:sc)?[a-f0-9]{12})$/i);
  const matchedId = idMatch ? idMatch[1] : null;
  return {
    id: matchedId && matchedId.startsWith("sc") ? matchedId.toUpperCase() : matchedId,
    nameSlug,
  };
};

export const getProductUrl = (slug) =>
  `${BASE_URL}/products/${slug}`;

export const parseProductSpecs = (product) => {
  const specs = {};
  const description = product?.Description || "";

  description
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const [rawKey, ...rawValue] = line.split(":");
      if (!rawKey || rawValue.length === 0) return;
      const key = cleanText(rawKey).toLowerCase();
      const value = cleanText(rawValue.join(":"));
      if (!value) return;

      if (key.includes("part number")) specs.partNumber = value;
      if (key.includes("serial number")) specs.serialNumber = value;
      if (key.includes("system model")) specs.systemModel = value;
      if (key.includes("system manufacturer")) specs.manufacturer = value;
      if (key.includes("category")) specs.category = value;
    });

  return specs;
};

export const getProductPartNumbers = (product) => {
  const specs = parseProductSpecs(product);
  const explicitPartValues = [product?.PN, specs.partNumber];
  const searchableTextValues = [product?.Name, product?.Description];
  const values = new Set();

  explicitPartValues.filter(Boolean).forEach((value) => {
    cleanText(value)
      .split(/[,/|;]/)
      .map((part) => cleanText(part))
      .filter(Boolean)
      .forEach((part) => values.add(part));
  });

  [...explicitPartValues, ...searchableTextValues].filter(Boolean).forEach((value) => {
    const matches = cleanText(value).match(PRODUCT_CODE_PATTERN) || [];
    matches.forEach((match) => values.add(match.toUpperCase()));
  });

  return [...values].filter((value) => !/^temp-\d+$/i.test(value)).slice(0, 8);
};

export const buildProductKeywords = (product) => {
  const specs = parseProductSpecs(product);
  const partNumbers = getProductPartNumbers(product);
  const name = cleanText(product?.Name);
  const oem = cleanText(product?.OEM || specs.manufacturer);
  const modality = cleanText(product?.Modality || specs.category);
  const model = cleanText(product?.Machine || specs.systemModel);
  const productType = name.match(/\b(CT Tube|MRI|CT|PET\/CT|Tube|Coil|Detector|Board|Power Supply)\b/i)?.[0];

  return [
    name,
    ...partNumbers,
    ...partNumbers.map((part) => `${part} ${productType || "part"}`),
    model,
    model && productType ? `${model} ${productType}` : "",
    oem && modality ? `${oem} ${modality} part` : "",
    modality && productType ? `${modality} ${productType}` : "",
    "medical imaging parts",
    "CT and MRI parts",
  ].filter(Boolean);
};

export const buildProductSeoTitle = (product) => {
  const name = cleanText(product?.Name) || "Imaging Part";
  const specs = parseProductSpecs(product);
  const partNumbers = getProductPartNumbers(product);
  const primaryPart = partNumbers[0] && !name.toLowerCase().includes(partNumbers[0].toLowerCase())
    ? partNumbers[0]
    : "";
  const oem = cleanText(product?.OEM || specs.manufacturer);
  const modality = cleanText(product?.Modality || specs.category);
  const productLabel = [name, primaryPart].filter(Boolean).join(" ");
  const suffix = [oem, modality && `${modality} Part`].filter(Boolean).join(" ");
  const title = suffix
    ? `${productLabel} | ${suffix} | Advanced Imaging Services`
    : `${productLabel} | Advanced Imaging Services`;

  if (title.length <= 70) return title;
  const compactTitle = suffix ? `${productLabel} | ${suffix}` : `${productLabel} | AIS`;
  return compactTitle.length <= 70 ? compactTitle : `${name} | Advanced Imaging`;
};

export const buildProductSeoDescription = (product) => {
  const name = cleanText(product?.Name) || "Imaging part";
  const specs = parseProductSpecs(product);
  const partNumbers = getProductPartNumbers(product);
  const oem = cleanText(product?.OEM || specs.manufacturer);
  const modality = cleanText(product?.Modality || specs.category);
  const model = cleanText(product?.Machine || specs.systemModel);
  const identifiers = partNumbers.length ? ` Part numbers: ${partNumbers.slice(0, 4).join(", ")}.` : "";
  const compatibility = [oem, model, modality].filter(Boolean).join(" ");

  return truncateText(
    `${name} is a medical imaging equipment part available from Advanced Imaging Services.${identifiers} Request pricing, availability, compatibility, and service support${compatibility ? ` for ${compatibility} systems` : ""}.`,
    170
  );
};

export const buildProductImageAlt = (product, index = 0) => {
  const name = cleanText(product?.Name) || "Imaging part";
  const partNumbers = getProductPartNumbers(product);
  const primaryPart = partNumbers[0] ? ` ${partNumbers[0]}` : "";
  return cleanText(`${name}${primaryPart} product image${index ? ` ${index + 1}` : ""}`);
};
