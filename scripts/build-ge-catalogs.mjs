import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const DATA_ROOT = path.join(ROOT, "data");
const GENERATED_AT = new Date().toISOString();

const OEM_CONFIGS = {
  GE: {
    folder: "GE",
    displayName: "GE HealthCare",
    aliases: ["GE", "GE HEALTHCARE", "GENERAL ELECTRIC"],
    officialSource: "ge",
    reviewedFile: path.join("MRI", "GE", "common-MRI-GE-import.json"),
  },
  PHILIPS: {
    folder: "Philips",
    displayName: "Philips Healthcare",
    aliases: ["PHILIPS", "PHILIPS HEALTHCARE", "PHILIPS MEDICAL SYSTEMS"],
    officialSource: null,
    reviewedFile: null,
  },
  SIEMENS: {
    folder: "Siemens",
    displayName: "Siemens Healthineers",
    aliases: ["SIEMENS", "SIEMENS MEDICAL SOLUTIONS", "SIEMENS HEALTHINEERS"],
    officialSource: null,
    reviewedFile: null,
  },
  TOSHIBA: {
    folder: "Toshiba",
    displayName: "Toshiba / Canon Medical",
    aliases: [
      "TOSHIBA",
      "TOSHIBA AMERICA MEDICAL SYSTEMS",
      "TOSHIBA AMERICA MEDICAL SYSTEMS TAMS",
      "CANON MEDICAL",
      "CANON MEDICAL SYSTEMS USA",
      "CANON MEDICAL SYSTEMS USA INC",
    ],
    officialSource: null,
    reviewedFile: null,
  },
};

const requestedOem = cleanArgument(process.argv.slice(2).find((value) => value.startsWith("--oem="))?.split("=")[1] || "GE");
const OEM_CONFIG = OEM_CONFIGS[requestedOem.toUpperCase()];
if (!OEM_CONFIG) {
  throw new Error(`Unsupported OEM ${requestedOem}. Use GE, Philips, Siemens, or Toshiba.`);
}
const OEM = OEM_CONFIG.folder;

const MODALITIES = {
  MRI: { folder: "MRI", label: "MRI" },
  CT: { folder: "CT", label: "CT" },
  PET: { folder: "PET", label: "PET/CT" },
};

const SOURCE_PRIORITY = {
  reviewed: 120,
  ge: 110,
  ais: 100,
  partssource: 80,
  block: 70,
  dotmed: 60,
};

const SOURCE_NAMES = {
  reviewed: "AIS reviewed cross-source record",
  ge: "GE HealthCare Service Shop",
  ais: "Advanced Imaging Services",
  partssource: "PartsSource",
  block: "Block Imaging",
  dotmed: "DOTmed",
};

const BAD_IMAGE_RE = /(?:catalog-fallback|generic[_-]coming|coming[_-]?soon|missing[_-]?product|placeholder|no[_-]?image|image[_-]?unavailable|spacer\.(?:gif|png)|slide1\.png)/i;
const GENERIC_NAME_RE = /^(?:n\/?a|na|none|unknown|untitled|parts?|ge|siemens|toshiba|canon|item)$/i;
const INVALID_PARTS = new Set([
  "N/A", "NA", "NONE", "UNKNOWN", "MRI", "CT", "PET", "PETCT",
  "GE", "SIEMENS", "TOSHIBA", "CANON",
]);

function cleanArgument(value) {
  return String(value ?? "").trim();
}
const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const normalizePartNumber = (value) => clean(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
const normalizeManufacturer = (value) => clean(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
const manufacturerMatches = (value) => {
  const normalized = normalizeManufacturer(value);
  return OEM_CONFIG.aliases.some((alias) => {
    const candidate = normalizeManufacturer(alias);
    return normalized === candidate || normalized.startsWith(candidate);
  });
};
const normalizeName = (value) => clean(value)
  .normalize("NFKD")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim()
  .replace(/\s+/g, " ");
const slugify = (value) => clean(value)
  .normalize("NFKD")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");
const unique = (values) => [...new Set(values.map(clean).filter(Boolean))];

function isValidPartNumber(value) {
  const display = clean(value).toUpperCase();
  const normalized = normalizePartNumber(display);
  return normalized.length >= 3 && normalized.length <= 48 &&
    /\d/.test(normalized) && !INVALID_PARTS.has(display) && !INVALID_PARTS.has(normalized);
}

function extractPartNumbers(value) {
  const values = Array.isArray(value) ? value.flatMap(extractPartNumbers) : [value];
  const result = [];

  for (const raw of values) {
    const text = clean(raw).replace(/^OEM\s*#?:?\s*/i, "");
    if (!text) continue;
    const pieces = text.split(/\s*(?:,|;|\||\/|\bor\b)\s*/i).filter(Boolean);
    for (const piece of pieces.length ? pieces : [text]) {
      const display = clean(piece).replace(/^[([]+|[)\].]+$/g, "").toUpperCase();
      if (isValidPartNumber(display)) result.push(display);
    }
  }

  return unique(result);
}

function modalityKey(value, fallback) {
  const normalized = clean(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (normalized.includes("MRI") || normalized === "MR") return "MRI";
  if (normalized.includes("PET")) return "PET";
  if (normalized.includes("CT")) return "CT";
  return fallback;
}

function sourceUrl(raw, source) {
  if (source === "dotmed") return clean(raw.listingUrl || raw.sourceUrl);
  return clean(raw.sourceUrl || raw.productUrl || raw.url);
}

function candidateImage(raw, source, pageUrl) {
  const values = [
    raw?.image?.url,
    raw.imageUrl,
    raw.PrimaryImage,
    ...(Array.isArray(raw.Images) ? raw.Images : []),
    ...(Array.isArray(raw.imagePaths) ? raw.imagePaths : []),
    ...(Array.isArray(raw.ImagePaths) ? raw.ImagePaths : []),
  ].map(clean).filter(Boolean);

  for (const url of values) {
    if (BAD_IMAGE_RE.test(url)) continue;
    const isRemote = /^https?:\/\//i.test(url);
    const isStoragePath = /^Parts\//i.test(url) || /^\/assets\//i.test(url);
    if (!isRemote && !isStoragePath) continue;
    if (isRemote) {
      try {
        new URL(url);
      } catch {
        continue;
      }
    }
    const reviewStatus = source === "reviewed"
      ? "manually-reviewed"
      : source === "ge"
        ? "manufacturer-product-image"
        : source === "ais"
          ? "ais-product-image"
          : "source-product-image";
    return {
      url,
      provider: SOURCE_NAMES[source],
      sourcePage: clean(raw?.image?.page || pageUrl),
      reviewStatus,
      remoteSource: isRemote,
    };
  }

  return null;
}

function compatibleModels(raw) {
  const values = [raw.model, raw.Machine, ...(Array.isArray(raw.models) ? raw.models : [])];
  if (Array.isArray(raw.compatibleWith)) {
    for (const item of raw.compatibleWith) {
      if (typeof item === "string") values.push(item);
      else if (item && typeof item === "object") {
        values.push(item.model, item.modelName, item.equipmentName, item.name);
      }
    }
  }
  return unique(values).filter((value) => value.length <= 120);
}

function adaptRecord(raw, source, fallbackModality, sourceOrder, sourceFile) {
  const primaryValues = extractPartNumbers(
    raw.partNumber || raw.originalPartNumber || raw.PN || raw.manufacturerPartNumber
  );
  if (!primaryValues.length) return { rejection: "missing-or-invalid-part-number" };

  const alternateValues = unique([
    ...primaryValues.slice(1),
    ...extractPartNumbers(raw.alternatePartNumbers),
    ...extractPartNumbers(raw.equivalentItems),
  ]);
  const partNumber = primaryValues[0];
  const name = clean(raw.partName || raw.name || raw.Name || raw.title || raw.description);
  if (!name || name.length < 3 || GENERIC_NAME_RE.test(name)) {
    return { rejection: "missing-or-generic-name", partNumber };
  }

  const manufacturer = clean(raw.manufacturer || raw.OEM || OEM);
  const sourceManufacturer = clean(raw.sourceManufacturer);
  if (!manufacturerMatches(manufacturer) && !manufacturerMatches(sourceManufacturer)) {
    return { rejection: "manufacturer-mismatch", partNumber };
  }

  const modality = modalityKey(raw.modality || raw.Modality, fallbackModality);
  if (!MODALITIES[modality]) return { rejection: "unsupported-modality", partNumber };
  const url = sourceUrl(raw, source);
  const thumbnail = candidateImage(raw, source, url);
  const sourceName = SOURCE_NAMES[source];

  return {
    source,
    sourceName,
    sourceFile,
    sourceOrder: Number(raw.sourceOrder || raw.firstSeenOrder || sourceOrder || 0),
    partNumber,
    normalizedPartNumber: normalizePartNumber(partNumber),
    alternatePartNumbers: alternateValues,
    name,
    description: clean(raw.description || raw.Description),
    modality,
    models: compatibleModels(raw),
    sourceUrl: url,
    thumbnail,
  };
}

class UnionFind {
  constructor() {
    this.parent = new Map();
  }
  add(value) {
    if (!this.parent.has(value)) this.parent.set(value, value);
  }
  find(value) {
    this.add(value);
    const parent = this.parent.get(value);
    if (parent !== value) this.parent.set(value, this.find(parent));
    return this.parent.get(value);
  }
  union(left, right) {
    const a = this.find(left);
    const b = this.find(right);
    if (a !== b) this.parent.set(b, a);
  }
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

function sourceItems(value) {
  if (Array.isArray(value)) return value;
  return value.items || value.parts || value.products || value.results || [];
}

async function existingIds() {
  const file = path.join(ROOT, "public", "assets", "data", "parts.json");
  const records = await readJson(file);
  const ids = new Map();
  for (const record of sourceItems(records)) {
    if (!manufacturerMatches(record.OEM || record.manufacturer)) continue;
    const normalized = normalizePartNumber(record.PN || record.partNumber);
    if (normalized && record.id) ids.set(normalized, clean(record.id));
  }

  if (!OEM_CONFIG.reviewedFile) return ids;
  const reviewedFile = path.join(DATA_ROOT, OEM_CONFIG.reviewedFile);
  try {
    const reviewed = await readJson(reviewedFile);
    for (const record of sourceItems(reviewed)) {
      const normalized = normalizePartNumber(record.partNumber);
      if (normalized && record.id) ids.set(normalized, clean(record.id));
    }
  } catch {
    // The reviewed source is optional for future OEM runs.
  }
  return ids;
}

async function collectCandidates() {
  const candidates = [];
  const rejected = [];
  const sourceStats = {};
  const sourceFiles = [];

  for (const [modality, config] of Object.entries(MODALITIES)) {
    const directory = path.join(DATA_ROOT, config.folder, OEM);
    let files = [];
    try {
      files = await fs.readdir(directory);
    } catch {
      continue;
    }

    const filenamePattern = new RegExp(
      `^(ge|partssource(?:-[a-z0-9]+)?|block|dotmed|ais)-${modality}-${OEM}\\.json$`,
      "i"
    );
    for (const filename of files) {
      const match = filename.match(filenamePattern);
      if (!match) continue;
      const sourceVariant = match[1].toLowerCase();
      const source = sourceVariant.startsWith("partssource") ? "partssource" : sourceVariant;
      if (source === "ge" && OEM_CONFIG.officialSource !== "ge") continue;
      const file = path.join(directory, filename);
      const payload = await readJson(file);
      const records = sourceItems(payload);
      sourceFiles.push(path.relative(ROOT, file).replace(/\\/g, "/"));
      const statsKey = `${modality}:${sourceVariant}`;
      sourceStats[statsKey] = { raw: records.length, accepted: 0, rejected: 0 };

      records.forEach((raw, index) => {
        const adapted = adaptRecord(raw, source, modality, index + 1, filename);
        if (adapted.rejection) {
          sourceStats[statsKey].rejected += 1;
          if (rejected.length < 250) rejected.push({ modality, source: sourceVariant, ...adapted });
        } else {
          sourceStats[statsKey].accepted += 1;
          candidates.push(adapted);
        }
      });
    }
  }

  const reviewedFile = OEM_CONFIG.reviewedFile
    ? path.join(DATA_ROOT, OEM_CONFIG.reviewedFile)
    : null;
  try {
    if (!reviewedFile) throw new Error("No reviewed file configured");
    const reviewed = await readJson(reviewedFile);
    const records = sourceItems(reviewed);
    sourceFiles.push(path.relative(ROOT, reviewedFile).replace(/\\/g, "/"));
    sourceStats["MRI:reviewed"] = { raw: records.length, accepted: 0, rejected: 0 };
    records.forEach((raw, index) => {
      const adapted = adaptRecord(raw, "reviewed", "MRI", index + 1, "common-MRI-GE-import.json");
      if (adapted.rejection) sourceStats["MRI:reviewed"].rejected += 1;
      else {
        sourceStats["MRI:reviewed"].accepted += 1;
        candidates.push(adapted);
      }
    });
  } catch {
    // Optional reviewed list.
  }

  const aisFile = path.join(ROOT, "public", "assets", "data", "parts.json");
  const aisRecords = sourceItems(await readJson(aisFile)).filter((record) =>
    manufacturerMatches(record.OEM || record.manufacturer) && MODALITIES[modalityKey(record.Modality)]
  );
  sourceFiles.push(path.relative(ROOT, aisFile).replace(/\\/g, "/"));
  sourceStats["ALL:ais"] = { raw: aisRecords.length, accepted: 0, rejected: 0 };
  aisRecords.forEach((raw, index) => {
    const modality = modalityKey(raw.Modality);
    const adapted = adaptRecord(raw, "ais", modality, index + 1, "parts.json");
    if (adapted.rejection) sourceStats["ALL:ais"].rejected += 1;
    else {
      sourceStats["ALL:ais"].accepted += 1;
      candidates.push(adapted);
    }
  });

  return { candidates, rejected, sourceStats, sourceFiles: unique(sourceFiles) };
}

function candidateScore(candidate) {
  const descriptionBonus = Math.min(candidate.description.length, 500) / 100;
  const nameBonus = Math.min(candidate.name.length, 100) / 100;
  return SOURCE_PRIORITY[candidate.source] * 1000 - candidate.sourceOrder + descriptionBonus + nameBonus;
}

function generatedId(root) {
  return `SC${crypto.createHash("sha256").update(`${OEM}|${root}`).digest("hex").slice(0, 12).toUpperCase()}`;
}

function legitimacyFor(candidates) {
  const sources = new Set(candidates.map((candidate) => candidate.source));
  if (sources.has("ge")) return { status: "verified", basis: "official-manufacturer-catalog" };
  if (sources.has("reviewed")) return { status: "verified", basis: "manually-reviewed-cross-source" };
  if (sources.has("ais")) return { status: "verified", basis: "ais-product-record" };
  if (sources.size > 1) return { status: "verified", basis: "multiple-independent-catalogs" };
  return { status: "accepted", basis: "specialist-catalog-listing" };
}

async function buildCatalog() {
  const { candidates, rejected, sourceStats, sourceFiles } = await collectCandidates();
  const ids = await existingIds();
  const union = new UnionFind();
  const displayByNormalized = new Map();

  for (const candidate of candidates) {
    union.add(candidate.normalizedPartNumber);
    displayByNormalized.set(candidate.normalizedPartNumber, candidate.partNumber);
    for (const alternate of candidate.alternatePartNumbers) {
      const normalized = normalizePartNumber(alternate);
      if (!normalized) continue;
      displayByNormalized.set(normalized, alternate);
      union.union(candidate.normalizedPartNumber, normalized);
    }
  }

  const groups = new Map();
  for (const candidate of candidates) {
    const root = union.find(candidate.normalizedPartNumber);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(candidate);
  }

  const items = [];
  for (const [root, group] of groups) {
    const ranked = [...group].sort((a, b) => candidateScore(b) - candidateScore(a));
    const best = ranked[0];
    const allNormalized = [...union.parent.keys()].filter((value) => union.find(value) === root);
    const canonicalNormalized = ranked
      .map((candidate) => candidate.normalizedPartNumber)
      .find((value) => ids.has(value)) || best.normalizedPartNumber;
    const partNumber = displayByNormalized.get(canonicalNormalized) || best.partNumber;
    const id = ids.get(canonicalNormalized) || generatedId(root);
    const modalities = [...new Set(group.map((candidate) => candidate.modality))]
      .sort((a, b) => Object.keys(MODALITIES).indexOf(a) - Object.keys(MODALITIES).indexOf(b));
    const models = unique(group.flatMap((candidate) => candidate.models)).sort();
    const thumbnails = ranked.map((candidate) => candidate.thumbnail).filter(Boolean);
    const thumbnail = thumbnails[0] || null;
    const sources = [];
    const sourceKeys = new Set();
    for (const candidate of ranked) {
      const key = `${candidate.source}|${candidate.sourceUrl}|${candidate.modality}`;
      if (sourceKeys.has(key)) continue;
      sourceKeys.add(key);
      sources.push({
        provider: candidate.sourceName,
        providerKey: candidate.source,
        modality: candidate.modality,
        partNumber: candidate.partNumber,
        name: candidate.name,
        url: candidate.sourceUrl,
        sourceFile: candidate.sourceFile,
      });
    }
    const legitimacy = legitimacyFor(group);
    const alternatePartNumbers = allNormalized
      .filter((value) => value !== canonicalNormalized)
      .map((value) => displayByNormalized.get(value) || value)
      .sort();
    const name = best.name;
    const slug = `${slugify(name)}-${slugify(partNumber)}-${slugify(id)}`
      .slice(0, 140)
      .replace(/-+$/g, "");

    items.push({
      id,
      PN: partNumber,
      PNNormalized: canonicalNormalized,
      AlternatePartNumbers: alternatePartNumbers,
      Name: name,
      NameNormalized: normalizeName(name),
      Slug: slug,
      Description: `${name} is a ${OEM_CONFIG.displayName} ${modalities.map((key) => MODALITIES[key].label).join(" and ")} replacement part identified by part number ${partNumber}. Contact Advanced Imaging Services to confirm system compatibility, sourcing, condition, and current availability.`,
      OEM,
      Modalities: modalities.map((key) => MODALITIES[key].label),
      Models: models,
      Machine: models[0] || "",
      PrimaryImage: thumbnail?.url || "",
      Images: thumbnail ? [thumbnail.url] : [],
      Thumbnail: thumbnail || { status: "missing", reviewStatus: "no-legitimate-image-found" },
      CatalogOnly: true,
      InventoryTracked: false,
      Available: false,
      Condition: "Call for availability",
      Legitimacy: { ...legitimacy, sourceCount: sources.length },
      Sources: sources,
    });
  }

  items.sort((a, b) => a.Name.localeCompare(b.Name) || a.PN.localeCompare(b.PN));

  const seenIds = new Set();
  const seenPartNumbers = new Map();
  for (const item of items) {
    if (seenIds.has(item.id)) throw new Error(`Duplicate catalog ID ${item.id}`);
    seenIds.add(item.id);
    for (const value of [item.PN, ...item.AlternatePartNumbers]) {
      const normalized = normalizePartNumber(value);
      if (seenPartNumbers.has(normalized)) {
        throw new Error(`Part number ${value} appears in ${seenPartNumbers.get(normalized)} and ${item.id}`);
      }
      seenPartNumbers.set(normalized, item.id);
    }
  }

  return { items, candidates, rejected, sourceStats, sourceFiles, uniquePartNumberCount: seenPartNumbers.size };
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(temporary, file);
}

const result = await buildCatalog();
const summarizeLegitimacy = (items) => items.reduce((counts, item) => {
  const status = item.Legitimacy?.status || "unknown";
  counts[status] = (counts[status] || 0) + 1;
  return counts;
}, {});
const combinedThumbnailCount = result.items.filter((item) => item.PrimaryImage).length;
const combinedLegitimacyCounts = summarizeLegitimacy(result.items);
const combinedMetadata = {
  generatedAt: GENERATED_AT,
  manufacturer: OEM_CONFIG.displayName,
  catalogPurpose: "Website sourcing catalog; separate from tracked inventory.",
  itemCount: result.items.length,
  representedPartNumberCount: result.uniquePartNumberCount,
  candidateSourceRecordCount: result.candidates.length,
  rejectedSourceRecordCount: Object.values(result.sourceStats).reduce((sum, value) => sum + value.rejected, 0),
  legitimacyCounts: combinedLegitimacyCounts,
  thumbnailCount: combinedThumbnailCount,
  missingThumbnailCount: result.items.length - combinedThumbnailCount,
  duplicateCheck: "Passed across canonical and alternate normalized part numbers.",
  idRule: `Existing AIS IDs are preserved; new IDs use SC plus 12 uppercase SHA-256 characters from ${OEM}|canonical group.`,
  legitimacyRule: "AIS, reviewed cross-source, official manufacturer, PartsSource, Block Imaging, and DOTmed modality records are accepted after manufacturer, part-number, and name validation.",
  thumbnailRule: "Known placeholders are rejected. Exact reviewed, manufacturer, AIS, and source product images are retained; missing is preferred over an unrelated image.",
  sourceFiles: result.sourceFiles,
};

const combinedFile = path.join(DATA_ROOT, OEM, `final-${OEM}-catalog.json`);
await writeJson(combinedFile, { metadata: combinedMetadata, items: result.items });

for (const [key, config] of Object.entries(MODALITIES)) {
  const items = result.items
    .filter((item) => item.Modalities.includes(config.label))
    .map((item) => ({ ...item, Modality: config.label }));
  const withThumbnails = items.filter((item) => item.PrimaryImage).length;
  const representedPartNumberCount = new Set(
    items.flatMap((item) => [item.PN, ...item.AlternatePartNumbers].map(normalizePartNumber))
  ).size;
  const legitimacyCounts = summarizeLegitimacy(items);
  const file = path.join(DATA_ROOT, config.folder, OEM, `final-${key}-${OEM}.json`);
  await writeJson(file, {
    metadata: {
      ...combinedMetadata,
      modality: config.label,
      itemCount: items.length,
      representedPartNumberCount,
      legitimacyCounts,
      thumbnailCount: withThumbnails,
      missingThumbnailCount: items.length - withThumbnails,
      canonicalCombinedCatalog: `data/${OEM}/final-${OEM}-catalog.json`,
    },
    items,
  });
  console.log(`${key}: ${items.length.toLocaleString()} items, ${withThumbnails.toLocaleString()} legitimate thumbnail candidates`);
}

const missingThumbnails = result.items
  .filter((item) => !item.PrimaryImage)
  .map((item) => ({ id: item.id, PN: item.PN, Name: item.Name, Modalities: item.Modalities }));
const auditFile = path.join(DATA_ROOT, OEM, `final-${OEM}-catalog-audit.json`);
await writeJson(auditFile, {
  generatedAt: GENERATED_AT,
  sourceStats: result.sourceStats,
  combinedItemCount: result.items.length,
  representedPartNumberCount: result.uniquePartNumberCount,
  legitimacyCounts: combinedLegitimacyCounts,
  thumbnailCount: combinedThumbnailCount,
  missingThumbnailCount: missingThumbnails.length,
  missingThumbnails,
  rejectedExamples: result.rejected,
});

console.log(`Combined: ${result.items.length.toLocaleString()} canonical items`);
console.log(`Wrote ${path.relative(ROOT, combinedFile)} and ${path.relative(ROOT, auditFile)}`);
