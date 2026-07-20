import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data", "MRI", "GE");
const IMAGE_DIR = path.join(DATA_DIR, "common-images");
const SOURCE_FILE = path.join(DATA_DIR, "common-image-sources.json");
const MANIFEST_FILE = path.join(DATA_DIR, "common-MRI-GE-import.json");
const BATCH = "common-ge-mri-2026-07-17";
const BUCKET = "magmo-ac10c.appspot.com";
const EXPECTED = 31;

const NAMES = {
  "5112668-2": "Physiological Acquisition Controller with Vector Gating",
  "5116657": "SCSI Tower",
  "5135723": "Power Distribution Unit Control Board",
  "5138527": "Patient Handling Power Supply Lite",
  "5146875": "GP3 Assembly",
  "5148389-2": "MR SCIM Operator Control Module",
  "5151531": "DCERD2 4-Channel Receiver with Firmware",
  "5154662": "HDV 1.5T Reference Clock and Narrow Band Exciter Module",
  "5160929-2": "SRI4 Remote Intercom Board 3",
  "5165957-51": "128-to-32 Channel TDM Assembly",
  "5167035": "CAN Fiber Optic DVMR Assembly",
  "5174169": "HDV Remote Receiver Module",
  "5176921": "Gradient Amplifier Assembly",
  "5177062-20": "HDV Control Panel Kit",
  "5179918": "MRI Cradle Wheel Kit",
  "5196918": "Primary Magnet Rundown Unit MRU2006",
  "5215012": "Patient Handling Power Supply",
  "5250028": "Remote RF Digital Interface 2 Board",
  "5250066": "IRF3 Interface and Remote Board",
  "5250106": "MUX 2 Board",
  "5250122": "Extreme Gradient Amplifier Control Board",
  "5250214": "PCI Non-Transparent Bridge Board",
  "5309197": "1kV Dynamic Disable Filter Module",
  "5342679": "Large Cylindrical Unified MRI Phantom",
  "5342680": "Small Cylindrical Unified MRI Phantom",
  "5343347": "TL Unified MRI Phantom",
  "5351002": "DC Power Supply Tray Assembly",
  "5371622-2": "Hypertronics B-Bezel Cable Harness",
  "5393370-2": "MR SCIM Black Operator Control Module",
  "5438959": "RDK-408A3 Cold Head and Gasket Kit",
  "5911000-8": "Gen 4.1 HDxt 16-Channel Image Compute Node",
};

const MACHINES = {
  "5116657": "Signa Excite",
  "5146875": "GE 1.5T MRI",
  "5154662": "Signa HD / HDx 1.5T",
  "5174169": "Discovery MRI",
  "5177062-20": "Discovery MR750 3.0T",
  "5250028": "Signa HDxt 1.5T",
  "5250066": "Brivo MR355 / Discovery MR750 / Optima MR360",
  "5351002": "Optima MR360 1.5T",
  "5371622-2": "Signa HD 1.5T",
  "5911000-8": "Signa HDxt",
};

const normalize = (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const scId = (pn) => `SC${crypto.createHash("sha256").update(normalize(pn)).digest("hex").slice(0, 12).toUpperCase()}`;
const tokenFor = (id) => {
  const hex = crypto.createHash("sha256").update(`${BATCH}:${id}`).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
const json = async (file) => JSON.parse(await fs.readFile(file, "utf8"));
const items = (value) => Array.isArray(value) ? value : value.items || [];
const indexByPn = (value) => new Map(items(value).map((item) => [normalize(item.partNumber || item.PN), item]));
const itemUrl = (item, source) => source === "dotmed"
  ? item.listingUrl || item.sourceUrl || ""
  : item.sourceUrl || item.productUrl || item.url || "";

function argumentsForRun() {
  const args = process.argv.slice(2);
  const numberAfter = (flag, fallback) => {
    const index = args.indexOf(flag);
    return index < 0 ? fallback : Number(args[index + 1]);
  };
  return {
    mode: args.includes("--apply") ? "apply" : args.includes("--prepare") ? "prepare" : args.includes("--verify") ? "verify" : args.includes("--audit-live") ? "audit-live" : "dry-run",
    start: numberAfter("--start", 0),
    limit: numberAfter("--limit", EXPECTED),
  };
}

async function candidates() {
  const [dotmed, block, partssource, imageSources] = await Promise.all([
    json(path.join(DATA_DIR, "dotmed-MRI-GE.json")),
    json(path.join(DATA_DIR, "block-MRI-GE.json")),
    json(path.join(DATA_DIR, "partssource-MRI-GE.json")),
    json(SOURCE_FILE),
  ]);
  const maps = { dotmed: indexByPn(dotmed), block: indexByPn(block), partssource: indexByPn(partssource) };
  const shared = [...maps.dotmed.keys()].filter((key) => maps.block.has(key) && maps.partssource.has(key));
  if (shared.length !== EXPECTED) {
    throw new Error(`Expected ${EXPECTED} shared part numbers; found ${shared.length}.`);
  }
  const result = shared.map((key, index) => {
    const sourceItems = {
      dotmed: maps.dotmed.get(key),
      block: maps.block.get(key),
      partssource: maps.partssource.get(key),
    };
    const pn = sourceItems.dotmed.partNumber || sourceItems.dotmed.PN;
    const image = imageSources.images?.[pn];
    if (!image?.url) throw new Error(`Missing reviewed image for ${pn}.`);
    const id = scId(pn);
    return {
      sequence: index + 1,
      id,
      partNumber: pn,
      normalizedPartNumber: key,
      name: NAMES[pn] || sourceItems.partssource.partName || sourceItems.block.partName,
      machine: MACHINES[pn] || sourceItems.partssource.model || sourceItems.block.model || "GE MRI",
      image: {
        ...image,
        localPath: `data/MRI/GE/common-images/${id}.jpg`,
        storagePath: `Parts/${id}/${id}.jpg`,
      },
      sources: {
        dotmed: { name: sourceItems.dotmed.partName || "", url: itemUrl(sourceItems.dotmed, "dotmed") },
        partssource: { name: sourceItems.partssource.partName || "", url: itemUrl(sourceItems.partssource, "partssource") },
        block: { name: sourceItems.block.partName || "", url: itemUrl(sourceItems.block, "block") },
      },
    };
  });
  if (new Set(result.map((item) => item.id)).size !== result.length) throw new Error("Generated SC IDs are not unique.");
  return result;
}

async function writeManifest(list, preparation = {}) {
  const output = {
    generatedAt: new Date().toISOString(),
    importBatch: BATCH,
    comparison: {
      rule: "Part number appears in DOTmed, PartsSource, and Block Imaging GE MRI source files.",
      matchedCount: list.length,
      existingAisDuplicatesExcluded: 0,
    },
    idRule: "SC plus the first 12 uppercase hexadecimal characters of SHA-256(normalized part number).",
    availabilityPolicy: "Imported research candidates are listed as Call for availability; no stock claim is made.",
    preparation,
    items: list,
  };
  await fs.writeFile(MANIFEST_FILE, `${JSON.stringify(output, null, 2)}\n`, "utf8");
}

async function downloadImage(candidate) {
  const response = await fetch(candidate.image.url, {
    redirect: "follow",
    headers: {
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      Referer: candidate.image.page || "https://advancedimagingparts.com/",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
    },
  });
  if (!response.ok) throw new Error(`${candidate.partNumber}: image returned HTTP ${response.status}.`);
  const source = Buffer.from(await response.arrayBuffer());
  const metadata = await sharp(source).metadata();
  if (!metadata.width || !metadata.height || metadata.width < 120 || metadata.height < 100 || metadata.width * metadata.height < 40000) {
    throw new Error(`${candidate.partNumber}: image is invalid or too small (${metadata.width || 0}x${metadata.height || 0}).`);
  }
  const output = await sharp(source)
    .rotate()
    .resize(1200, 900, { fit: "contain", background: "#ffffff" })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
  await fs.writeFile(path.join(IMAGE_DIR, `${candidate.id}.jpg`), output);
  return {
    partNumber: candidate.partNumber,
    id: candidate.id,
    sourceDimensions: `${metadata.width}x${metadata.height}`,
    bytes: output.length,
    sha256: crypto.createHash("sha256").update(output).digest("hex"),
  };
}

async function prepare(list) {
  await fs.mkdir(IMAGE_DIR, { recursive: true });
  const prepared = [];
  for (let index = 0; index < list.length; index += 1) {
    prepared.push(await downloadImage(list[index]));
    console.log(`PREPARED ${index + 1}/${list.length} ${list[index].partNumber}`);
  }
  await writeManifest(list, { preparedAt: new Date().toISOString(), images: prepared });
}

async function loadEnvironment() {
  const raw = await fs.readFile(path.join(ROOT, ".env.production"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}

async function firebase() {
  await loadEnvironment();
  let account;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } else {
    const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
    if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) throw new Error("Missing Firebase Admin credentials.");
    account = { projectId: FIREBASE_PROJECT_ID, clientEmail: FIREBASE_CLIENT_EMAIL, privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") };
  }
  const app = getApps()[0] || initializeApp({ credential: cert(account), storageBucket: BUCKET });
  return { db: getFirestore(app), bucket: getStorage(app).bucket(BUCKET) };
}

const publicUrl = (storagePath, token) =>
  `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;

function recordFor(candidate, imageUrl) {
  return {
    PN: candidate.partNumber,
    Name: candidate.name,
    Description: `${candidate.name}, GE part number ${candidate.partNumber}, for GE MRI service and replacement-part requests. This part number appears in the reviewed DOTmed, PartsSource, and Block Imaging GE MRI catalogs. Contact Advanced Imaging Services to confirm compatibility, condition, pricing, and current availability.`,
    OEM: "GE",
    Modality: "MRI",
    Machine: candidate.machine,
    Available: false,
    Condition: "Call for availability",
    Sold: 0,
    Date: "2026-07-17",
    Images: [imageUrl],
    ImagePaths: [candidate.image.storagePath],
    SourceMatchedOn: ["DOTmed", "PartsSource", "Block Imaging"],
    SourceUrls: candidate.sources,
    ImageSource: {
      provider: candidate.image.source,
      page: candidate.image.page || "",
      originalUrl: candidate.image.url,
      imagePartNumber: candidate.image.imagePartNumber || candidate.partNumber,
      note: candidate.image.note || "Reviewed product image without a visible watermark.",
    },
    ImportBatch: BATCH,
    ImportedAt: FieldValue.serverTimestamp(),
  };
}

async function assertPrepared(list) {
  for (const candidate of list) {
    const metadata = await sharp(path.join(IMAGE_DIR, `${candidate.id}.jpg`)).metadata().catch(() => null);
    if (!metadata || metadata.width !== 1200 || metadata.height !== 900) {
      throw new Error(`Prepared image missing or invalid for ${candidate.partNumber}; run --prepare first.`);
    }
  }
}

async function apply(list, start, limit) {
  await assertPrepared(list);
  const { db, bucket } = await firebase();
  const snapshot = await db.collection("Parts").get();
  const existingByPn = new Map();
  snapshot.docs.forEach((doc) => {
    const key = normalize(doc.data().PN);
    if (key) existingByPn.set(key, doc.id);
  });
  for (const candidate of list.slice(start, start + limit)) {
    const duplicateId = existingByPn.get(candidate.normalizedPartNumber);
    const reference = db.collection("Parts").doc(candidate.id);
    const existing = await reference.get();
    if (duplicateId && duplicateId !== candidate.id) {
      console.log(`SKIP DUPLICATE ${candidate.sequence}/${list.length} ${candidate.partNumber} ${duplicateId}`);
      continue;
    }
    if (existing.exists) {
      if (normalize(existing.data().PN) !== candidate.normalizedPartNumber) throw new Error(`ID collision at ${candidate.id}.`);
      console.log(`EXISTS ${candidate.sequence}/${list.length} ${candidate.partNumber} ${candidate.id}`);
      continue;
    }
    const token = tokenFor(candidate.id);
    await bucket.upload(path.join(IMAGE_DIR, `${candidate.id}.jpg`), {
      destination: candidate.image.storagePath,
      metadata: {
        contentType: "image/jpeg",
        cacheControl: "public,max-age=31536000,immutable",
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });
    await reference.create(recordFor(candidate, publicUrl(candidate.image.storagePath, token)));
    existingByPn.set(candidate.normalizedPartNumber, candidate.id);
    console.log(`ADDED ${candidate.sequence}/${list.length} ${candidate.partNumber} ${candidate.id}`);
  }
}

async function auditLive(list) {
  const { db } = await firebase();
  const snapshot = await db.collection("Parts").get();
  const existing = new Map();
  snapshot.docs.forEach((document) => {
    const key = normalize(document.data().PN);
    if (key) existing.set(key, document.id);
  });
  const duplicates = list.filter((candidate) => existing.has(candidate.normalizedPartNumber));
  console.log(`LIVE AUDIT: ${duplicates.length}/${list.length} already exist; ${list.length - duplicates.length} eligible for new SC records.`);
  duplicates.forEach((candidate) => console.log(`EXCLUDE ${candidate.partNumber} ${existing.get(candidate.normalizedPartNumber)}`));
}

async function verify(list) {
  const { db, bucket } = await firebase();
  const snapshot = await db.collection("Parts").get();
  const existingByPn = new Map();
  snapshot.docs.forEach((document) => {
    const key = normalize(document.data().PN);
    if (key) existingByPn.set(key, document.id);
  });
  const results = [];
  let imported = 0;
  let preserved = 0;
  for (let index = 0; index < list.length; index += 1) {
    const candidate = list[index];
    const catalogId = existingByPn.get(candidate.normalizedPartNumber);
    if (catalogId && catalogId !== candidate.id) {
      const document = await db.collection("Parts").doc(catalogId).get();
      if (!document.exists) throw new Error(`Missing preserved Firestore record ${catalogId}.`);
      preserved += 1;
      results.push({ partNumber: candidate.partNumber, status: "preexisting-preserved", catalogId });
      console.log(`PRESERVED ${index + 1}/${list.length} ${candidate.partNumber} ${catalogId}`);
      continue;
    }
    const [document, [metadata]] = await Promise.all([
      db.collection("Parts").doc(candidate.id).get(),
      bucket.file(candidate.image.storagePath).getMetadata(),
    ]);
    if (!document.exists) throw new Error(`Missing Firestore record ${candidate.id}.`);
    const data = document.data();
    if (data.PN !== candidate.partNumber || data.ImportBatch !== BATCH || data.Available !== false) throw new Error(`Unexpected data for ${candidate.id}.`);
    if (metadata.contentType !== "image/jpeg") throw new Error(`Unexpected image metadata for ${candidate.id}.`);
    imported += 1;
    results.push({ partNumber: candidate.partNumber, status: "imported", catalogId: candidate.id, imagePath: candidate.image.storagePath });
    console.log(`VERIFIED ${index + 1}/${list.length} ${candidate.partNumber} ${candidate.id}`);
  }
  const manifest = await json(MANIFEST_FILE);
  manifest.liveResult = { verifiedAt: new Date().toISOString(), imported, preserved, records: results };
  await fs.writeFile(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`LIVE VERIFIED: ${imported} imported SC records and ${preserved} preexisting records preserved.`);
}

async function main() {
  const options = argumentsForRun();
  const list = await candidates();
  if (options.mode === "dry-run") {
    await writeManifest(list);
    console.log(`DRY RUN: ${list.length} new GE MRI parts; no Firebase writes made.`);
  } else if (options.mode === "prepare") {
    await prepare(list);
  } else if (options.mode === "apply") {
    await apply(list, options.start, options.limit);
  } else if (options.mode === "verify") {
    await verify(list);
  } else {
    await auditLive(list);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
