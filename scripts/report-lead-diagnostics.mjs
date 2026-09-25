import nextEnv from "@next/env";
import { cert, initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { redactAnalyticsText } from "../app/data/analyticsPrivacy.mjs";
import { buildLeadDeliveryReport } from "../app/data/leadMeasurement.mjs";

// Read-only diagnostic counts; never export customer messages or raw click IDs.
nextEnv.loadEnvConfig(process.cwd());
const [start, end] = process.argv.slice(2);
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || "") &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
if (![start, end].every(validDate) || start > end || Date.parse(end) - Date.parse(start) > 89 * 86_400_000) {
  throw new Error("Usage: node scripts/report-lead-diagnostics.mjs YYYY-MM-DD YYYY-MM-DD (maximum 90 days)");
}
const account = process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON) : {
  project_id: process.env.FIREBASE_PROJECT_ID, client_email: process.env.FIREBASE_CLIENT_EMAIL,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
};
const app = initializeApp({ credential: cert(account) }, "lead-diagnostics");
try {
  const snapshot = await getFirestore(app).collection("WebsiteAnalyticsEvents")
    .where("date", ">=", start).where("date", "<=", end).orderBy("date").limit(10001)
    .select("date", "eventType", "path", "formType", "acquisitionSource", "properties.error_stage",
      "properties.error_reason", "properties.acquisition_source", "properties.form_type",
      "properties.lead_id", "properties.confirmed_by", "measurement").get();
  const groups = new Map();
  const events = snapshot.docs.slice(0, 10000).map((doc) => ({ ...doc.data(), id: doc.id }));
  for (const doc of snapshot.docs.slice(0, 10000)) {
    const event = doc.data();
    if (!["form_error", "page_not_found"].includes(event.eventType)) continue;
    const group = {
      event: event.eventType,
      path: redactAnalyticsText(String(event.path || "").split(/[?#]/)[0], 300),
      formType: event.formType || event.properties?.form_type || "",
      stage: event.properties?.error_stage || "",
      reason: event.properties?.error_reason || "",
      channel: event.acquisitionSource || event.properties?.acquisition_source || "unknown",
    };
    const key = JSON.stringify(group);
    if (!groups.has(key)) groups.set(key, { ...group, count: 0, lastDate: event.date });
    groups.get(key).count++;
    groups.get(key).lastDate = event.date;
  }
  const rows = [...groups.values()].sort((a, b) => b.count - a.count);
  console.log(JSON.stringify({ period: { start, end, timezone: "UTC" }, truncated: snapshot.size > 10000,
    deliveryDiagnostics: buildLeadDeliveryReport(events),
    formErrors: rows.filter((row) => row.event === "form_error"),
    paidNotFound: rows.filter((row) => row.event === "page_not_found" && row.channel === "paid_search"),
    topNotFound: rows.filter((row) => row.event === "page_not_found").slice(0, 10),
  }, null, 2));
} finally {
  await deleteApp(app);
}
