const normalizeText = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const normalizePartNumber = (value) =>
  String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const appendValues = (value, output) => {
  if (value == null) return;
  if (Array.isArray(value)) {
    value.forEach((entry) => appendValues(entry, output));
    return;
  }
  if (typeof value === "object") {
    appendValues(value.description ?? value.Description ?? value.text ?? value.value, output);
    return;
  }
  output.push(String(value));
};

const getValues = (...values) => {
  const output = [];
  values.forEach((value) => appendValues(value, output));
  return [...new Set(output.filter(Boolean))];
};

const normalizedTextValues = (...values) =>
  getValues(...values).map(normalizeText).filter(Boolean);

const normalizedPartNumberValues = (...values) => {
  const output = new Set();
  getValues(...values).forEach((value) => {
    const normalized = normalizePartNumber(value);
    if (normalized) output.add(normalized);

    String(value)
      .split(/[,;|/\n]+/)
      .map(normalizePartNumber)
      .filter(Boolean)
      .forEach((partNumber) => output.add(partNumber));
  });
  return [...output];
};

const textTermScore = (values, term, weight) => {
  let score = 0;
  for (const value of values) {
    const words = value.split(" ").filter(Boolean);
    if (words.includes(term)) {
      score = Math.max(score, weight + 30);
    } else if (words.some((word) => word.startsWith(term))) {
      score = Math.max(score, weight + 15);
    } else if (value.includes(term)) {
      score = Math.max(score, weight);
    } else if (value.replace(/\s+/g, "").includes(term.replace(/\s+/g, ""))) {
      score = Math.max(score, Math.max(1, weight - 5));
    }
  }
  return score;
};

const partNumberTermScore = (values, term, weight) => {
  const normalizedTerm = normalizePartNumber(term);
  if (!normalizedTerm) return 0;

  let score = 0;
  for (const value of values) {
    if (value === normalizedTerm) {
      score = Math.max(score, weight + 30);
    } else if (value.startsWith(normalizedTerm)) {
      score = Math.max(score, weight + 15);
    } else if (value.includes(normalizedTerm)) {
      score = Math.max(score, weight);
    }
  }
  return score;
};

const getSearchGroups = (product = {}) => ({
  names: normalizedTextValues(product.Name, product.name, product.NameNormalized),
  descriptions: normalizedTextValues(
    product.Description,
    product.description,
    product.Descriptions,
    product.descriptions
  ),
  partNumbers: normalizedPartNumberValues(
    product.PN,
    product.pn,
    product.PartNumber,
    product.partNumber,
    product.PNNormalized
  ),
  itemIds: normalizedPartNumberValues(product.id, product.ID, product.ItemID),
  details: normalizedTextValues(
    product.OEM,
    product.Modality,
    product.Machine,
    product.Model
  ),
});

export const normalizeCatalogSearchText = normalizeText;
export const normalizeCatalogPartNumber = normalizePartNumber;

// Mirrors Magmo's general-search behavior: every query term must match, while
// matches in stronger fields (name, item ID, and PN) rank ahead of descriptions.
export function getGeneralCatalogSearchScore(product = {}, query = "") {
  const normalizedQuery = normalizeText(query);
  const terms = normalizedQuery.split(" ").filter(Boolean);
  if (!terms.length) return 0;

  const groups = getSearchGroups(product);
  let score = 0;

  for (const term of terms) {
    const bestTermScore = Math.max(
      textTermScore(groups.names, term, 100),
      partNumberTermScore(groups.itemIds, term, 90),
      partNumberTermScore(groups.partNumbers, term, 80),
      textTermScore(groups.descriptions, term, 50),
      textTermScore(groups.details, term, 25)
    );
    if (bestTermScore === 0) return 0;
    score += bestTermScore;
  }

  if (groups.names.some((value) => value === normalizedQuery)) score += 75;
  if (groups.names.some((value) => value.startsWith(normalizedQuery))) score += 35;

  const compactQuery = normalizePartNumber(query);
  if (compactQuery) {
    if (groups.partNumbers.includes(compactQuery)) score += 60;
    if (groups.itemIds.includes(compactQuery)) score += 45;
  }

  return score;
}

export function getPartNumberCatalogSearchScore(product = {}, query = "") {
  const normalizedQuery = normalizePartNumber(query);
  if (!normalizedQuery) return 0;

  const groups = getSearchGroups(product);
  const partNumberScore = partNumberTermScore(groups.partNumbers, normalizedQuery, 100);
  const itemIdScore = partNumberTermScore(groups.itemIds, normalizedQuery, 80);
  return Math.max(partNumberScore, itemIdScore);
}

export function getCatalogSearchScore(product = {}, queries = {}) {
  const nameQuery = normalizeText(queries.name);
  const partNumberQuery = normalizePartNumber(queries.partNumber);
  let score = 0;

  if (nameQuery) {
    const nameScore = getGeneralCatalogSearchScore(product, nameQuery);
    if (!nameScore) return 0;
    score += nameScore;
  }

  if (partNumberQuery) {
    const partNumberScore = getPartNumberCatalogSearchScore(product, partNumberQuery);
    if (!partNumberScore) return 0;
    score += partNumberScore;
  }

  return score;
}
