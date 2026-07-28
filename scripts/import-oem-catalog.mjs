import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { buildCatalogSearchFields } from "../app/data/partCatalogIndex.mjs";

const ROOT = process.cwd();
const OEM_POLICIES = {
  GE: {
    imageStatuses: [
      "ais-product-image",
      "manufacturer-product-image",
      "manually-reviewed",
    ],
    imageProviders: [
      "Advanced Imaging Services",
      "GE HealthCare Service Shop",
      "AIS reviewed cross-source record",
    ],
    rejectedPartNumbers: [],
  },
  Siemens: {
    imageStatuses: [
      "ais-product-image",
      "manufacturer-product-image",
      "manually-reviewed",
      "source-product-image",
    ],
    imageProviders: [
      "Advanced Imaging Services",
      "PartsSource",
      "AIS reviewed cross-source record",
    ],
    rejectedPartNumbers: [],
  },
  Toshiba: {
    imageStatuses: [
      "ais-product-image",
      "manufacturer-product-image",
      "manually-reviewed",
      "source-product-image",
    ],
    imageProviders: [
      "Advanced Imaging Services",
      "PartsSource",
      "AIS reviewed cross-source record",
    ],
    // Manual review found these thumbnails were diagrams or the wrong product.
    rejectedPartNumbers: ["9489287", "1789960", "4353962"],
  },
  Philips: {
    imageStatuses: [
      "ais-product-image",
      "manufacturer-product-image",
      "manually-reviewed",
      "source-product-image",
    ],
    imageProviders: [
      "Advanced Imaging Services",
      "PartsSource",
      "AIS reviewed cross-source record",
    ],
    rejectedPartNumbers: [],
  },
};
const IMAGE_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36";
const MIN_IMAGE_WIDTH = 200;
const MIN_IMAGE_HEIGHT = 150;
const MIN_IMAGE_PIXELS = 40_000;
const MIN_IMAGE_BYTES = 3_000;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const AUDIT_CONCURRENCY = 4;

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const normalizePartNumber = (value) =>
  clean(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
const sourceItems = (value) =>
  Array.isArray(value) ? value : value.items || value.parts || value.products || [];
const unique = (values) => [...new Set(values.map(clean).filter(Boolean))];

const parseArguments = () => {
  const args = process.argv.slice(2);
  const valueFor = (name, fallback = "") => {
    const prefix = `--${name}=`;
    return args.find((value) => value.startsWith(prefix))?.slice(prefix.length) || fallback;
  };
  const numberFor = (name, fallback) => {
    const value = Number(valueFor(name, fallback));
    return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
  };
  const mode = args.includes("--apply")
    ? "apply"
    : args.includes("--verify")
      ? "verify"
      : args.includes("--audit-live")
        ? "audit-live"
        : "audit-local";

  return {
    mode,
    oem: clean(valueFor("oem", "GE")),
    confirm: clean(valueFor("confirm")),
    start: numberFor("start", 0),
    limit: numberFor("limit", Number.MAX_SAFE_INTEGER),
    concurrency: Math.min(Math.max(numberFor("concurrency", 1), 1), 6),
  };
};

const options = parseArguments();
const policy = OEM_POLICIES[options.oem];
if (!policy) {
  throw new Error(
    `Unsupported OEM "${options.oem}". Choose ${Object.keys(OEM_POLICIES).join(", ")}.`
  );
}
const trustedImageStatuses = new Set(policy.imageStatuses);
const trustedImageProviders = new Set(policy.imageProviders);
const rejectedPartNumbers = new Set(policy.rejectedPartNumbers.map(normalizePartNumber));
const WRITE_CONFIRMATION = `START-${options.oem.toUpperCase()}-UPLOAD`;

const CATALOG_FILE = path.join(ROOT, "data", options.oem, `final-${options.oem}-catalog.json`);
const READINESS_FILE = path.join(
  ROOT,
  "data",
  options.oem,
  `upload-readiness-${options.oem}.json`
);
const IMPORT_BATCH = `website-catalog-${options.oem.toLowerCase()}-2026-07-23`;

const readJson = async (file) => JSON.parse(await fs.readFile(file, "utf8"));

async function loadEnvironment() {
  for (const filename of [".env.local", ".env.production"]) {
    let raw;
    try {
      raw = await fs.readFile(path.join(ROOT, filename), "utf8");
    } catch {
      continue;
    }
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[match[1]] = value;
    }
  }
}

async function firebase() {
  await loadEnvironment();
  let account;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } else {
    const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
    if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
      throw new Error("Missing Firebase Admin credentials.");
    }
    account = {
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    };
  }

  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET || `${account.projectId}.appspot.com`;
  const app =
    getApps()[0] ||
    initializeApp({
      credential: cert(account),
      storageBucket: bucketName,
    });
  return {
    db: getFirestore(app),
    bucket: getStorage(app).bucket(bucketName),
    bucketName,
  };
}

const allPartNumbers = (item) =>
  unique([item.PN, ...(Array.isArray(item.AlternatePartNumbers) ? item.AlternatePartNumbers : [])])
    .map(normalizePartNumber)
    .filter(Boolean);

function localEligibility(item) {
  if (!item?.id || !item?.PN || !item?.Name) return "missing-required-catalog-field";
  if (!item.PrimaryImage) return "missing-image";
  if (rejectedPartNumbers.has(normalizePartNumber(item.PN))) {
    return "manually-rejected-image";
  }
  if (!trustedImageStatuses.has(item.Thumbnail?.reviewStatus)) {
    return "image-not-reviewed";
  }
  if (!trustedImageProviders.has(item.Thumbnail?.provider)) {
    return "image-provider-not-approved";
  }
  if (!/^https?:\/\//i.test(item.PrimaryImage) && !/^Parts\//i.test(item.PrimaryImage)) {
    return "unsupported-image-location";
  }
  return "";
}

function indexExistingDocuments(snapshot) {
  const byPartNumber = new Map();
  const duplicatePartNumbers = new Map();
  for (const document of snapshot.docs) {
    const data = document.data();
    const values = unique([
      data.PN,
      data.PNNormalized,
      ...(Array.isArray(data.AlternatePartNumbers) ? data.AlternatePartNumbers : []),
    ]);
    for (const value of values) {
      const normalized = normalizePartNumber(value);
      if (!normalized) continue;
      if (byPartNumber.has(normalized) && byPartNumber.get(normalized) !== document.id) {
        duplicatePartNumbers.set(normalized, [byPartNumber.get(normalized), document.id]);
      } else {
        byPartNumber.set(normalized, document.id);
      }
    }
  }
  return { byPartNumber, duplicatePartNumbers };
}

const existingOwner = (item, existingByPartNumber) =>
  allPartNumbers(item).map((value) => existingByPartNumber.get(value)).find(Boolean) || "";

async function fetchRemoteImage(url, referer = "") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        Referer: referer || "https://advancedimagingparts.com/",
        "User-Agent": IMAGE_USER_AGENT,
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_IMAGE_BYTES) throw new Error("image-too-large");
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_IMAGE_BYTES) throw new Error("image-too-large");
    return buffer;
  } finally {
    clearTimeout(timeout);
  }
}

async function loadSourceImage(item, bucket) {
  if (/^https?:\/\//i.test(item.PrimaryImage)) {
    return fetchRemoteImage(item.PrimaryImage, item.Thumbnail?.sourcePage);
  }
  const [buffer] = await bucket.file(item.PrimaryImage).download();
  return buffer;
}

async function validateImage(item, bucket, includeBuffer = false) {
  const buffer = await loadSourceImage(item, bucket);
  if (buffer.length < MIN_IMAGE_BYTES) throw new Error("image-file-too-small");
  const metadata = await sharp(buffer, { failOn: "error" }).metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  if (
    width < MIN_IMAGE_WIDTH ||
    height < MIN_IMAGE_HEIGHT ||
    width * height < MIN_IMAGE_PIXELS
  ) {
    throw new Error(`image-dimensions-too-small:${width}x${height}`);
  }
  const result = {
    width,
    height,
    format: metadata.format || "",
    bytes: buffer.length,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
  };
  if (includeBuffer) result.buffer = buffer;
  return result;
}

async function runPool(values, worker, concurrency = AUDIT_CONCURRENCY) {
  const results = new Array(values.length);
  let nextIndex = 0;

  const run = async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(values[index], index);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => run())
  );
  return results;
}

async function localAudit(catalog) {
  const reasons = {};
  const candidates = [];
  for (const item of catalog.items) {
    const reason = localEligibility(item);
    if (reason) reasons[reason] = (reasons[reason] || 0) + 1;
    else candidates.push(item);
  }

  const seen = new Map();
  const duplicateGroups = [];
  for (const item of candidates) {
    for (const partNumber of allPartNumbers(item)) {
      if (seen.has(partNumber) && seen.get(partNumber) !== item.id) {
        duplicateGroups.push({ partNumber, ids: [seen.get(partNumber), item.id] });
      } else {
        seen.set(partNumber, item.id);
      }
    }
  }

  return { candidates, reasons, duplicateGroups };
}

async function auditLive(catalog) {
  const local = await localAudit(catalog);
  if (local.duplicateGroups.length) {
    throw new Error(`Catalog contains ${local.duplicateGroups.length} duplicate PN groups.`);
  }
  const { db, bucket } = await firebase();
  const snapshot = await db.collection("Parts").get();
  const existing = indexExistingDocuments(snapshot);
  const preexisting = [];
  const newCandidates = [];
  const invalidId = [];

  for (const item of local.candidates) {
    const owner = existingOwner(item, existing.byPartNumber);
    if (owner) {
      preexisting.push({ id: item.id, PN: item.PN, existingId: owner });
    } else if (!/^SC[A-F0-9]{12}$/.test(item.id)) {
      invalidId.push({ id: item.id, PN: item.PN });
    } else {
      newCandidates.push(item);
    }
  }

  const imageGroups = new Map();
  for (const item of newCandidates) {
    const key = item.PrimaryImage;
    if (!imageGroups.has(key)) imageGroups.set(key, []);
    imageGroups.get(key).push(item);
  }
  const uniqueImages = [...imageGroups.entries()];
  let completed = 0;
  const imageResults = await runPool(uniqueImages, async ([image, items]) => {
    try {
      const result = await validateImage(items[0], bucket);
      return { image, ok: true, ...result };
    } catch (error) {
      return { image, ok: false, error: clean(error.message) || "image-validation-failed" };
    } finally {
      completed += 1;
      if (completed === 1 || completed % 100 === 0 || completed === uniqueImages.length) {
        console.log(`IMAGE AUDIT ${completed}/${uniqueImages.length}`);
      }
    }
  });
  const imageResultByUrl = new Map(imageResults.map((result) => [result.image, result]));
  const ready = [];
  const rejectedImages = [];

  for (const item of newCandidates) {
    const result = imageResultByUrl.get(item.PrimaryImage);
    if (result?.ok) {
      ready.push({
        id: item.id,
        PN: item.PN,
        image: item.PrimaryImage,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
        sha256: result.sha256,
      });
    } else {
      rejectedImages.push({
        id: item.id,
        PN: item.PN,
        image: item.PrimaryImage,
        reason: result?.error || "image-validation-failed",
      });
    }
  }

  const readiness = {
    generatedAt: new Date().toISOString(),
    mode: "read-only-live-audit",
    oem: options.oem,
    sourceCatalog: path.relative(ROOT, CATALOG_FILE).replace(/\\/g, "/"),
    sourceCatalogItems: catalog.items.length,
    existingPartsCollectionCount: snapshot.size,
    existingPartsDuplicatePnGroups: [...existing.duplicatePartNumbers].map(
      ([partNumber, ids]) => ({ partNumber, ids })
    ),
    localEligibilityCount: local.candidates.length,
    localExclusions: local.reasons,
    preexistingCount: preexisting.length,
    preexisting,
    invalidNewIdCount: invalidId.length,
    invalidNewIds: invalidId,
    uniqueImagesChecked: uniqueImages.length,
    imageRejectedCount: rejectedImages.length,
    imageRejected: rejectedImages,
    readyToUploadCount: ready.length,
    ready,
    writeGuard: `--apply requires --confirm=${WRITE_CONFIRMATION}`,
  };
  await fs.writeFile(READINESS_FILE, `${JSON.stringify(readiness, null, 2)}\n`, "utf8");

  console.log(`LIVE PARTS: ${snapshot.size.toLocaleString()} records`);
  console.log(`PREEXISTING: ${preexisting.length.toLocaleString()} candidates`);
  console.log(`IMAGE REJECTED: ${rejectedImages.length.toLocaleString()} candidates`);
  console.log(`READY TO UPLOAD: ${ready.length.toLocaleString()} ${options.oem} parts`);
  console.log(`NO FIREBASE WRITES WERE MADE`);
  return readiness;
}

const firebaseToken = (id) => {
  const hex = crypto
    .createHash("sha256")
    .update(`${IMPORT_BATCH}:${id}`)
    .digest("hex")
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const publicImageUrl = (bucketName, storagePath, token) =>
  `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
    storagePath
  )}?alt=media&token=${token}`;

const primaryModality = (item) => {
  const modalities = Array.isArray(item.Modalities) ? item.Modalities : [];
  if (modalities.includes("PET/CT")) return "PET/CT";
  return modalities[0] || "MRI";
};

function firestoreRecord(item, imageUrl, storagePath) {
  const modality = primaryModality(item);
  const base = {
    PN: item.PN,
    PNNormalized: normalizePartNumber(item.PN),
    AlternatePartNumbers: item.AlternatePartNumbers || [],
    Name: item.Name,
    NameNormalized: item.NameNormalized,
    Description: item.Description,
    OEM: item.OEM,
    Modality: modality,
    Modalities: item.Modalities || [modality],
    Machine: item.Machine || item.Models?.[0] || "",
    Models: item.Models || [],
    Available: false,
    Condition: "Call for availability",
    Sold: 0,
    CatalogOnly: true,
    InventoryTracked: false,
    Slug: item.Slug,
    PrimaryImage: imageUrl,
    Images: [imageUrl],
    ImagePaths: [storagePath],
    ImageSource: {
      provider: item.Thumbnail?.provider || "",
      page: item.Thumbnail?.sourcePage || "",
      originalUrl: item.PrimaryImage,
      reviewStatus: item.Thumbnail?.reviewStatus || "",
    },
    Legitimacy: item.Legitimacy || {},
    Sources: item.Sources || [],
    ImportBatch: IMPORT_BATCH,
    ImportedAt: FieldValue.serverTimestamp(),
    UpdatedAt: FieldValue.serverTimestamp(),
  };
  return { ...base, ...buildCatalogSearchFields(base, item.id) };
}

async function apply(catalog) {
  if (options.confirm !== WRITE_CONFIRMATION) {
    throw new Error(
      `Write blocked. Re-run with --confirm=${WRITE_CONFIRMATION} only after approval.`
    );
  }
  const readiness = await readJson(READINESS_FILE);
  if (readiness.oem !== options.oem || !Array.isArray(readiness.ready)) {
    throw new Error("Missing or invalid upload readiness manifest.");
  }
  const age = Date.now() - Date.parse(readiness.generatedAt);
  if (!Number.isFinite(age) || age > 48 * 60 * 60 * 1000) {
    throw new Error("Readiness audit is older than 48 hours; run --audit-live again.");
  }

  const readyIds = new Set(readiness.ready.map((item) => item.id));
  const catalogById = new Map(catalog.items.map((item) => [item.id, item]));
  const selected = readiness.ready
    .slice(options.start, options.start + options.limit)
    .map((entry) => catalogById.get(entry.id))
    .filter((item) => item && readyIds.has(item.id));
  const { db, bucket, bucketName } = await firebase();
  const snapshot = await db.collection("Parts").get();
  const existing = indexExistingDocuments(snapshot);
  const existingIds = new Set(snapshot.docs.map((document) => document.id));
  let added = 0;
  let duplicates = 0;
  let imageRejected = 0;
  let writeFailures = 0;

  await runPool(selected, async (item, index) => {
    const owner = existingOwner(item, existing.byPartNumber);
    if (owner || existingIds.has(item.id)) {
      duplicates += 1;
      console.log(
        `SKIP DUPLICATE ${index + 1}/${selected.length} ${item.PN} ${owner || item.id}`
      );
      return;
    }

    let validation;
    try {
      validation = await validateImage(item, bucket, true);
    } catch (error) {
      imageRejected += 1;
      console.log(
        `SKIP IMAGE ${index + 1}/${selected.length} ${item.PN} ${clean(error.message)}`
      );
      return;
    }

    const output = await sharp(validation.buffer)
      .rotate()
      .resize(1200, 900, { fit: "contain", background: "#ffffff" })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
    const storagePath = `Parts/${item.id}/${item.id}.jpg`;
    const token = firebaseToken(item.id);
    const storageFile = bucket.file(storagePath);

    try {
      await storageFile.save(output, {
        resumable: false,
        contentType: "image/jpeg",
        metadata: {
          cacheControl: "public,max-age=31536000,immutable",
          metadata: { firebaseStorageDownloadTokens: token },
        },
      });
      const imageUrl = publicImageUrl(bucketName, storagePath, token);
      await db.collection("Parts").doc(item.id).create(
        firestoreRecord(item, imageUrl, storagePath)
      );
      allPartNumbers(item).forEach((partNumber) =>
        existing.byPartNumber.set(partNumber, item.id)
      );
      existingIds.add(item.id);
      added += 1;
      console.log(`ADDED ${index + 1}/${selected.length} ${item.PN} ${item.id}`);
    } catch (error) {
      writeFailures += 1;
      await storageFile.delete({ ignoreNotFound: true }).catch(() => {});
      console.log(
        `WRITE FAILED ${index + 1}/${selected.length} ${item.PN} ${clean(error.message)}`
      );
    }
  }, options.concurrency);

  console.log(`UPLOAD COMPLETE: ${added.toLocaleString()} ${options.oem} parts added`);
  console.log(`DUPLICATES SKIPPED: ${duplicates.toLocaleString()}`);
  console.log(`IMAGE FAILURES SKIPPED: ${imageRejected.toLocaleString()}`);
  console.log(`WRITE FAILURES: ${writeFailures.toLocaleString()}`);
  if (writeFailures) process.exitCode = 1;
}

async function verify() {
  const readiness = await readJson(READINESS_FILE);
  const expectedEntries = readiness.ready.slice(
    options.start,
    options.start + options.limit
  );
  const ready = new Map(expectedEntries.map((item) => [item.id, item]));
  const { db, bucket } = await firebase();
  const [snapshot, allPartsSnapshot] = await Promise.all([
    db
    .collection("Parts")
    .where("ImportBatch", "==", IMPORT_BATCH)
    .get(),
    db.collection("Parts").get(),
  ]);
  const targetDocuments = snapshot.docs.filter((document) => ready.has(document.id));
  const existing = indexExistingDocuments(allPartsSnapshot);
  const importedIds = new Set(snapshot.docs.map((document) => document.id));
  const missingIds = [...ready.keys()].filter((id) => !importedIds.has(id));
  let checked = 0;
  const results = await runPool(targetDocuments, async (document) => {
    const data = document.data();
    const expected = ready.get(document.id);
    const storagePath = data.ImagePaths?.[0];
    let exists = false;
    let contentType = "";
    if (storagePath) {
      [exists] = await bucket.file(storagePath).exists();
      if (exists) {
        const [metadata] = await bucket.file(storagePath).getMetadata();
        contentType = metadata.contentType || "";
      }
    }
    const ok =
      expected &&
      exists &&
      contentType === "image/jpeg" &&
      data.PN === expected.PN &&
      Array.isArray(data.Images) &&
      data.Images.length === 1 &&
      Array.isArray(data.SearchTerms) &&
      data.SearchTerms.length > 0 &&
      Array.isArray(data.PNPrefixes) &&
      data.PNPrefixes.length > 0;
    checked += 1;
    if (checked === 1 || checked % 500 === 0 || checked === targetDocuments.length) {
      console.log(`VERIFY PROGRESS ${checked}/${targetDocuments.length}`);
    }
    return ok
      ? null
      : {
          id: document.id,
          PN: data.PN || "",
          hasImage: exists,
          contentType,
          hasSearchTerms: Array.isArray(data.SearchTerms) && data.SearchTerms.length > 0,
        };
  }, 12);
  const failures = results.filter(Boolean);
  const verified = targetDocuments.length - failures.length;
  const searchSample = targetDocuments.find((document) => {
    const data = document.data();
    return clean(data.NameNormalized).split(" ").some((term) => term.length >= 6);
  }) || snapshot.docs[0];
  const searchSampleData = searchSample?.data() || {};
  const nameLookup = clean(searchSampleData.NameNormalized)
    .split(" ")
    .filter((term) => term.length >= 2)
    .sort((left, right) => right.length - left.length)[0] || "";
  const pnLookup = normalizePartNumber(searchSampleData.PN);
  const [nameSearch, pnSearch] = await Promise.all([
    nameLookup
      ? db
          .collection("Parts")
          .where("OEM", "==", options.oem)
          .where("SearchTerms", "array-contains", nameLookup)
          .limit(20)
          .get()
      : Promise.resolve({ docs: [] }),
    pnLookup
      ? db
          .collection("Parts")
          .where("OEM", "==", options.oem)
          .where("PNPrefixes", "array-contains", pnLookup)
          .limit(20)
          .get()
      : Promise.resolve({ docs: [] }),
  ]);
  const modalities = unique(
    targetDocuments.map((document) => document.data().Modality)
  );
  const modalityResults = await Promise.all(
    modalities.map((modality) =>
      db
        .collection("Parts")
        .where("OEM", "==", options.oem)
        .where("Modality", "==", modality)
        .orderBy("NameNormalized")
        .limit(1)
        .get()
    )
  );
  const searchChecks = {
    name: nameSearch.docs.some((document) => document.id === searchSample?.id),
    partNumber: pnSearch.docs.some((document) => document.id === searchSample?.id),
  };
  modalities.forEach((modality, index) => {
    searchChecks[modality] = !modalityResults[index].empty;
  });
  const failedSearchChecks = Object.entries(searchChecks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);

  console.log(`TOTAL PARTS: ${allPartsSnapshot.size.toLocaleString()}`);
  console.log(`BATCH RECORDS: ${snapshot.size.toLocaleString()}`);
  console.log(`TARGET RECORDS: ${ready.size.toLocaleString()}`);
  console.log(`VERIFIED: ${verified.toLocaleString()} imported ${options.oem} parts`);
  console.log(`MISSING EXPECTED IDS: ${missingIds.length.toLocaleString()}`);
  console.log(
    `DUPLICATE PN GROUPS: ${existing.duplicatePartNumbers.size.toLocaleString()}`
  );
  console.log(`SEARCH CHECKS: ${JSON.stringify(searchChecks)}`);
  console.log(`VERIFY FAILURES: ${failures.length.toLocaleString()}`);
  if (
    failures.length ||
    missingIds.length ||
    existing.duplicatePartNumbers.size ||
    failedSearchChecks.length ||
    targetDocuments.length !== ready.size
  ) {
    process.exitCode = 1;
  }
}

const catalog = await readJson(CATALOG_FILE);
catalog.items = sourceItems(catalog);

if (options.mode === "audit-local") {
  const audit = await localAudit(catalog);
  console.log(`CATALOG: ${catalog.items.length.toLocaleString()} ${options.oem} records`);
  console.log(`LOCALLY ELIGIBLE: ${audit.candidates.length.toLocaleString()}`);
  console.log(`LOCAL EXCLUSIONS: ${JSON.stringify(audit.reasons)}`);
  console.log(`DUPLICATE PN GROUPS: ${audit.duplicateGroups.length}`);
  console.log(`NO NETWORK CALLS OR FIREBASE WRITES WERE MADE`);
} else if (options.mode === "audit-live") {
  await auditLive(catalog);
} else if (options.mode === "apply") {
  await apply(catalog);
} else {
  await verify();
}
