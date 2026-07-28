import {
  normalizeCatalogPartNumber,
  normalizeCatalogSearchText,
} from "./partCatalogSearch.mjs";

const MAX_PREFIX_LENGTH = 32;
const MAX_SEARCH_TERMS = 400;

const appendValues = (value, output) => {
  if (value == null) return;
  if (Array.isArray(value)) {
    value.forEach((entry) => appendValues(entry, output));
    return;
  }
  if (typeof value === "object") {
    Object.values(value).forEach((entry) => appendValues(entry, output));
    return;
  }
  output.push(String(value));
};

const valuesFrom = (...values) => {
  const output = [];
  values.forEach((value) => appendValues(value, output));
  return output;
};

const prefixesFor = (value, minimumLength = 2) => {
  const output = [];
  const maximum = Math.min(value.length, MAX_PREFIX_LENGTH);
  for (let length = minimumLength; length <= maximum; length += 1) {
    output.push(value.slice(0, length));
  }
  return output;
};

export const buildCatalogSearchFields = (product = {}, id = product.id) => {
  const textValues = valuesFrom(
    product.Name,
    product.NameNormalized,
    product.OEM,
    product.Modality,
    product.Modalities,
    product.Machine,
    product.Model,
    product.Models
  );
  const searchTerms = new Set();

  for (const value of textValues) {
    const normalized = normalizeCatalogSearchText(value);
    for (const token of normalized.split(" ").filter((entry) => entry.length >= 2)) {
      prefixesFor(token).forEach((prefix) => searchTerms.add(prefix));
    }
  }

  const partNumberValues = valuesFrom(
    product.PN,
    product.PNNormalized,
    product.PartNumber,
    product.partNumber,
    product.AlternatePartNumbers,
    id
  )
    .map(normalizeCatalogPartNumber)
    .filter((value) => value.length >= 2);
  const partNumberPrefixes = new Set();

  for (const value of partNumberValues) {
    prefixesFor(value).forEach((prefix) => {
      partNumberPrefixes.add(prefix);
      searchTerms.add(prefix.toLowerCase());
    });
  }

  return {
    SearchTerms: [...searchTerms].sort().slice(0, MAX_SEARCH_TERMS),
    PNPrefixes: [...partNumberPrefixes].sort(),
  };
};

export const getCatalogSearchLookupTerm = (query = "") => {
  const tokens = normalizeCatalogSearchText(query)
    .split(" ")
    .filter((token) => token.length >= 2)
    .sort((left, right) => right.length - left.length);
  return tokens[0] || "";
};

export const getCatalogPartNumberLookupTerm = (query = "") =>
  normalizeCatalogPartNumber(query).slice(0, MAX_PREFIX_LENGTH);
