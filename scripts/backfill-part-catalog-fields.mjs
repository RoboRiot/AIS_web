import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const ROOT = process.cwd();
const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
const normalizeName = (value) => clean(value)
  .normalize("NFKD")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim()
  .replace(/\s+/g, " ");
const normalizePartNumber = (value) => clean(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
const slugify = (value) => clean(value)
  .normalize("NFKD")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

function buildSlug(id, data) {
  const pieces = [slugify(data.Name), slugify(data.PN), slugify(id)].filter(Boolean);
  return [...new Set(pieces)].join("-").slice(0, 140).replace(/-+$/g, "");
}

function primaryImage(id, data) {
  const images = Array.isArray(data.Images) ? data.Images : [];
  const imagePaths = Array.isArray(data.ImagePaths) ? data.ImagePaths : [];
  return clean(data.PrimaryImage || images[0] || imagePaths[0] || `Parts/${id}/${id}`);
}

async function loadEnvironment() {
  const raw = await fs.readFile(path.join(ROOT, ".env.production"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

async function database() {
  await loadEnvironment();
  let account;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } else {
    const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
    if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
      throw new Error("Missing Firebase Admin credentials in .env.production.");
    }
    account = {
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    };
  }

  const app = getApps()[0] || initializeApp({ credential: cert(account) });
  return getFirestore(app);
}

const apply = process.argv.includes("--apply");
const db = await database();
const snapshot = await db.collection("Parts").get();
const changes = [];

for (const doc of snapshot.docs) {
  const data = doc.data();
  const fields = {
    NameNormalized: normalizeName(data.Name),
    PNNormalized: normalizePartNumber(data.PN),
    Slug: buildSlug(doc.id, data),
    PrimaryImage: primaryImage(doc.id, data),
  };
  const changed = Object.fromEntries(
    Object.entries(fields).filter(([key, value]) => value && data[key] !== value)
  );
  if (Object.keys(changed).length) changes.push({ reference: doc.ref, id: doc.id, changed });
}

console.log(`Scanned ${snapshot.size} existing part records.`);
console.log(`${changes.length} records require catalog search metadata.`);

if (!apply) {
  for (const item of changes.slice(0, 10)) console.log(`DRY RUN ${item.id}`, item.changed);
  console.log("Run with --apply to write these metadata-only changes.");
  process.exit(0);
}

for (let offset = 0; offset < changes.length; offset += 400) {
  const batch = db.batch();
  const group = changes.slice(offset, offset + 400);
  for (const item of group) batch.update(item.reference, item.changed);
  await batch.commit();
  console.log(`UPDATED ${Math.min(offset + group.length, changes.length)}/${changes.length}`);
}

console.log("Catalog search metadata backfill complete.");
