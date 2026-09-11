const legacyNameSlug = (value) => String(value || "").trim().toLowerCase().normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function buildLegacyProductAliases(products) {
  const aliases = new Map();
  for (const product of products) {
    const slug = legacyNameSlug(product.Name);
    if (!slug || !product.id || !product.PN) continue;
    const candidate = { id: String(product.id), partNumber: String(product.PN).trim().toUpperCase() };
    if (aliases.has(slug) && aliases.get(slug)?.id !== candidate.id) aliases.set(slug, null);
    else if (!aliases.has(slug)) aliases.set(slug, candidate);
  }
  return aliases;
}

export function matchesLegacyProduct(reference, product) {
  return Boolean(reference && product && reference.id === String(product.id) &&
    reference.partNumber === String(product.PN || "").trim().toUpperCase());
}
