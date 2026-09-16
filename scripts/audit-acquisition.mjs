import nextEnv from "@next/env";
import { readFile } from "node:fs/promises";
import { cert, initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { buildLegacyProductAliases, matchesLegacyProduct } from "../app/data/legacyProductAliases.mjs";
import { getCampaignReadinessIssues } from "../app/data/catalogProductQuality.mjs";

// Read-only audit. Output excludes inquiry text, contact details, and click IDs.
nextEnv.loadEnvConfig(process.cwd());
const start = process.argv[2];
const end = process.argv[3];
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || "") &&
  !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
if (![start, end].every(validDate) || start > end) {
  throw new Error("Usage: node scripts/audit-acquisition.mjs YYYY-MM-DD YYYY-MM-DD");
}
const account = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
  : {
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    };
const app = initializeApp({ credential: cert(account) }, "acquisition-audit");
const db = getFirestore(app);
const tally = (rows, getKey) => rows.reduce((counts, row) => {
  const key = getKey(row) || "unknown";
  counts[key] = (counts[key] || 0) + 1;
  return counts;
}, {});
const withinRange = (date) => date >= start && date <= end;
try {
  const leads = await db.collection("mail")
    .where("metadata.createdAt", ">=", Timestamp.fromDate(new Date(`${start}T00:00:00Z`)))
    .where("metadata.createdAt", "<", Timestamp.fromMillis(Date.parse(`${end}T00:00:00Z`) + 86_400_000))
    .select("metadata.formType", "metadata.acquisitionSource", "metadata.clickIds",
      "metadata.qualificationStatus", "delivery.state")
    .limit(1000).get();
  const rows = leads.docs.map((doc) => doc.data());
  console.log(JSON.stringify({ dateRange: { start, end, timezone: "UTC" }, acceptedLeadRecords: rows.length,
    truncated: rows.length === 1000,
    bySource: tally(rows, (row) => row.metadata?.acquisitionSource),
    byForm: tally(rows, (row) => row.metadata?.formType),
    byQualification: tally(rows, (row) => row.metadata?.qualificationStatus),
    byDeliveryState: tally(rows, (row) => row.delivery?.state),
    withClickId: rows.filter((row) => Object.values(row.metadata?.clickIds || {}).some(Boolean)).length,
  }, null, 2));
  const errors = await db.collection("WebsiteAnalyticsEvents")
    .where("eventType", "==", "page_not_found")
    .select("date", "path", "properties.referrer_path")
    .limit(2000).get();
  const missing = errors.docs.map((doc) => doc.data()).filter((row) => withinRange(row.date));
  console.log(JSON.stringify({ firstParty404s: missing.length,
    queryMayBeTruncated: errors.size === 2000,
    paths: tally(missing, (row) => row.path),
    referrers: tally(missing, (row) => row.properties?.referrer_path),
  }, null, 2));
  const catalog = JSON.parse(await readFile(new URL("../public/assets/data/parts.json", import.meta.url), "utf8"));
  const aliases = buildLegacyProductAliases(catalog);
  const resolution = [];
  for (const path of new Set(missing.map((row) => row.path))) {
    const reference = aliases.get(path.split("/").pop());
    if (!reference) { resolution.push({ path, reason: "no-unambiguous-historical-alias" }); continue; }
    const doc = await db.collection("Parts").doc(reference.id).get();
    const product = doc.exists ? { ...doc.data(), id: doc.id } : null;
    resolution.push({ path, id: reference.id, samePart: matchesLegacyProduct(reference, product),
      issues: product ? getCampaignReadinessIssues(product) : ["missing-record"],
      ...(process.argv.includes("--catalog-details") ? { current: product && {
        Name: product.Name, PN: product.PN, OEM: product.OEM, Modality: product.Modality,
        Description: product.Description,
      }, historical: catalog.find((item) => String(item.id) === reference.id) } : {}),
    });
  }
  console.log(JSON.stringify({ legacyResolution: resolution }, null, 2));
} catch (error) {
  console.error("Read-only audit failed:", error.response?.status || error.code || error.message);
  process.exitCode = 1;
} finally {
  await deleteApp(app);
}
