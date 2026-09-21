import nextEnv from "@next/env";
import { cert, initializeApp, deleteApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

// Explicit, one-record review. Default is read-only. Never sends email or Google events.
const [id, expectedSource, expectedType, category, modality, flag] = process.argv.slice(2);
const types = { trailer: "trailer_request", service: "service_request", parts: "part_request", contact: "contact_form" };
const target = types[category];
if (!/^[a-f0-9]{32}$/.test(id || "") || !target || !Object.values(types).includes(expectedType) ||
    !["mri", "ct", "pet_ct", "multiple", "unknown"].includes(modality) || !expectedSource ||
    (flag && flag !== "--apply")) {
  throw new Error("Usage: review-lead-intent.mjs HASH EXPECTED_SOURCE EXPECTED_FORM CATEGORY MODALITY [--apply]");
}
nextEnv.loadEnvConfig(process.cwd());
const account = process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON) : {
  project_id: process.env.FIREBASE_PROJECT_ID, client_email: process.env.FIREBASE_CLIENT_EMAIL,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
};
const app = initializeApp({ credential: cert(account) }, "review-lead-intent");
try {
  const db = getFirestore(app);
  const result = await db.runTransaction(async (transaction) => {
    const mailRef = db.doc(`mail/website-${id}`);
    const eventRef = db.doc(`WebsiteAnalyticsEvents/lead-${id}`);
    const funnelRef = db.doc(`WebsiteLeadFunnels/${id}`);
    const mail = await transaction.get(mailRef);
    const event = await transaction.get(eventRef);
    const funnel = await transaction.get(funnelRef);
    if (![mail, event, funnel].every((doc) => doc.exists)) throw new Error("Incomplete accepted lead; refusing repair.");
    if (mail.get("metadata.intentReviewStatus") === "reviewed" && mail.get("metadata.formType") === target &&
        event.get("formType") === target && funnel.get("formType") === target) return { alreadyReviewed: true };
    if (mail.get("metadata.formType") !== expectedType || event.get("formType") !== expectedType ||
        funnel.get("formType") !== expectedType || target === expectedType ||
        mail.get("metadata.acquisitionSource") !== expectedSource || event.get("acquisitionSource") !== expectedSource ||
        funnel.get("acquisitionSource") !== expectedSource || !funnel.get("milestones.form_submit") ||
        event.get("properties.confirmed_by") !== "lead_api") throw new Error("Review preconditions changed; refusing repair.");
    const dailyRef = db.doc(`WebsiteAnalyticsDaily/${event.get("date")}`);
    const daily = await transaction.get(dailyRef);
    for (const key of ["forms", "humanForms"]) {
      if (!(daily.get(`${key}.${expectedType}.form_submit`) >= 1)) throw new Error("Missing daily count; refusing repair.");
    }
    const preview = { applied: flag === "--apply", id, from: expectedType, to: target,
      modality, acquisitionSourceUnchanged: expectedSource, totalLeadsUnchanged: daily.get("totals.form_submit") };
    if (flag !== "--apply") return preview;
    const review = { previousFormType: expectedType, reason: "User-authorized business-intent review",
      reviewedAt: FieldValue.serverTimestamp() };
    const classification = { formType: target, selectedFormType: expectedType, businessCategory: category,
      modality, intentSource: "reviewed", intentReviewStatus: "reviewed", intentReview: review };
    transaction.update(mailRef, Object.fromEntries(Object.entries(classification).map(([key, value]) => [`metadata.${key}`, value])));
    transaction.update(eventRef, { ...classification, "properties.form_type": target,
      "properties.selected_form_type": expectedType, "properties.business_category": category, "properties.modality": modality });
    transaction.update(funnelRef, { ...classification, updatedAt: FieldValue.serverTimestamp() });
    transaction.update(dailyRef, {
      [`forms.${expectedType}.form_submit`]: FieldValue.increment(-1),
      [`humanForms.${expectedType}.form_submit`]: FieldValue.increment(-1),
      [`forms.${target}.form_submit`]: FieldValue.increment(1),
      [`humanForms.${target}.form_submit`]: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return preview;
  });
  console.log(JSON.stringify(result, null, 2));
} finally { await deleteApp(app); }
