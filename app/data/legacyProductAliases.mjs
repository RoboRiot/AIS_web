import { cleanCatalogProductName, getCatalogIdentifiers } from "./catalogProductQuality.mjs";
import { verifiedLegacyProductRoutes } from "./verifiedLegacyProductRoutes.mjs";

const legacyNameSlug = (value) => String(value || "").trim().toLowerCase().normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function buildLegacyProductAliases(products, verifiedRoutes = verifiedLegacyProductRoutes) {
  const aliases = new Map();
  const addAlias = (slug, candidate) => {
    if (!slug) return;
    const existing = aliases.get(slug);
    if (aliases.has(slug) && (!existing || existing.id !== candidate.id ||
        existing.partNumber !== candidate.partNumber)) aliases.set(slug, null);
    else aliases.set(slug, { ...existing, ...candidate });
  };
  for (const product of products) {
    const identifiers = getCatalogIdentifiers(product);
    const name = cleanCatalogProductName({ ...product, PN: identifiers.PN });
    const names = [product.Name, name];
    // The imported Name sometimes lost words or gained a duplicated revision.
    // Preserve the original heading only from the structured, labeled record.
    const description = String(product.Description || "");
    const heading = description.split(/\r?\n/)[0].trim();
    if (/\bPart Number\s*:/i.test(description) && heading.length >= 3 &&
        heading.length <= 160 && !/[:!?]/.test(heading)) names.push(heading);
    const numbers = identifiers.PN.split(/[,/|;]/).map((value) => value.trim()).filter(Boolean);
    if (!product.id || !identifiers.PN) continue;
    const candidate = { id: String(product.id), partNumber: identifiers.PN.toUpperCase() };
    const slugs = new Set(names.flatMap((value) => [legacyNameSlug(value),
      ...numbers.flatMap((number) => [legacyNameSlug(`${value} ${number}`), legacyNameSlug(`${number} ${value}`)])]));
    // This historical WordPress URL named the MX200 tube, not the whole scanner.
    if (String(product.id) === "97352cf7c8ab1" && /Lightspeed Performix MX200 CT Tube/i.test(name)) slugs.add("mx200");
    if (String(product.id) === "0f794eb65008" && identifiers.PN === "5128204") slugs.add("vct-signal-interface-board-5128204");
    if (String(product.id) === "temp-42" && identifiers.PN === "186852") slugs.add("46-186852-p2-relay-k2-back-up-connection");
    if (String(product.id) === "a761c231a605" && identifiers.PN === "5136400-3" && /Center Digital Module Kit/i.test(name)) {
      slugs.add("vct-64-center-digital-module-kit-sherlock-5136400-3");
    }
    if (String(product.id) === "bd1b36a1ab69" && identifiers.PN === "PX79-11217" && /KGTSM/i.test(name)) {
      slugs.add("kgtsm-px79-11217");
    }
    if (String(product.id) === "d4da9b3f66bd" && identifiers.PN === "2324697-2" && /SCSI CABLE/i.test(name)) {
      slugs.add("scsi-cable-vhd68-to-cent-50-linux-2324697-2");
    }
    if (String(product.id) === "bbebb2371560" && identifiers.PN === "46-264442G3" && /1\.5T Preamp/i.test(name)) {
      slugs.add("1-5t-preamp-46-264442g3");
    }
    for (const slug of slugs) addAlias(slug, candidate);
  }
  // Newer verified records may not exist in the original import. Resolution still
  // checks the live ID, full part number, manufacturer, visibility, and images.
  for (const { slug, ...reference } of verifiedRoutes) addAlias(slug, reference);
  return aliases;
}

export function matchesLegacyProduct(reference, product) {
  return Boolean(reference && product && reference.id === String(product.id) &&
    reference.partNumber === getCatalogIdentifiers(product).PN.toUpperCase() &&
    (!reference.oem || reference.oem === getCatalogIdentifiers(product).OEM.toUpperCase()));
}
