import nextEnv from "@next/env";
import { cert, initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { buildChannelReport } from "../app/data/channelReport.mjs";

// Read-only, bounded report. No inquiry content, contact details or click IDs are exported.
nextEnv.loadEnvConfig(process.cwd());
const [start, end] = process.argv.slice(2);
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || "") &&
  !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
if (![start, end].every(validDate) || start > end || Date.parse(end) - Date.parse(start) > 89 * 86_400_000) {
  throw new Error("Usage: node scripts/report-marketing-channels.mjs YYYY-MM-DD YYYY-MM-DD (maximum 90 days)");
}
const account = process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON) : {
  project_id: process.env.FIREBASE_PROJECT_ID, client_email: process.env.FIREBASE_CLIENT_EMAIL,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
};
const app = initializeApp({ credential: cert(account) }, "marketing-channel-report");
try {
  const db = getFirestore(app);
  const snapshot = await db.collection("WebsiteAnalyticsEvents").where("date", ">=", start)
    .where("date", "<=", end).orderBy("date").limit(10001)
    .select("eventType", "visitorHash", "formType", "businessCategory", "acquisitionSource", "referrerHost", "utm",
      "properties.lead_id", "properties.confirmed_by", "properties.acquisition_source", "properties.referrer_host",
      "properties.utm_source", "properties.utm_medium", "properties.utm_campaign", "properties.utm_content").get();
  const events = snapshot.docs.slice(0, 10000).map((doc) => ({ id: doc.id, ...doc.data() }));
  const ids = [...new Set(events.filter((row) => row.id === `lead-${row.properties?.lead_id}`)
    .map((row) => row.properties.lead_id).filter((id) => /^[a-z0-9-]{8,100}$/.test(id)))];
  const qualifications = {};
  for (let offset = 0; offset < ids.length; offset += 100) {
    const docs = await db.getAll(...ids.slice(offset, offset + 100).map((id) => db.collection("WebsiteLeadFunnels").doc(id)),
      { fieldMask: ["qualificationStatus"] });
    for (const doc of docs) qualifications[doc.id] = doc.get("qualificationStatus") || "unreviewed";
  }
  console.log(JSON.stringify({ period: { start, end, timezone: "UTC" }, truncated: snapshot.size > 10000,
    notes: ["Tracked visitors are distinct per source/placement, not additive across channels.",
      "Phone/email clicks are not confirmed calls or leads. Off-site inquiries need separate source logging.",
      "Qualified counts require explicit review; unreviewed inquiries are not assumed qualified.",
      "New placement fields populate after deployment. Missing historical tags cannot be reconstructed reliably."],
    rows: buildChannelReport(events, qualifications),
  }, null, 2));
} catch (error) {
  console.error("Marketing report failed:", error.code || error.message);
  process.exitCode = 1;
} finally {
  await deleteApp(app);
}
