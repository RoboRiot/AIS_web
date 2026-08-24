import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  buildLeadEmailHtml,
  buildLeadText,
  sanitizeLeadForm,
} from "@/components/utils/formSecurity";
import {
  cleanPath,
  cleanText,
  consumeRateLimit,
  hashIdentifier,
  isProductionAnalyticsRequest,
  isTrustedOrigin,
  readJsonBody,
} from "@/app/data/requestSecurity";
import { normalizeLeadAnalytics } from "@/app/data/leadAnalytics.mjs";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";


const FORM_CONFIG = {
  contact_form: {
    expectedAction: "contact_form",
    subject: "[AIS WEBSITE] General Contact Request",
    requiresPartNumber: false,
    label: "General contact",
  },
  part_request: {
    expectedAction: "part_request",
    subject: "[AIS WEBSITE] Medical Imaging Part Request",
    requiresPartNumber: true,
    requiresMessage: false,
    label: "Part request",
  },
  service_request: {
    expectedAction: "service_request",
    subject: "[AIS WEBSITE] Imaging Service Request",
    requiresPartNumber: false,
    label: "Service request",
  },
  trailer_request: {
    expectedAction: "trailer_request",
    subject: "[AIS WEBSITE] Mobile Trailer Rental Request",
    requiresPartNumber: false,
    label: "Trailer rental request",
  },
};

const getRecipients = () =>
  (process.env.EMAIL_RECIPIENTS || process.env.emailAccounts || "")
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);

const getServiceAccount = () => {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  }

  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    return null;
  }

  return {
    projectId: FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  };
};

const getAdminDb = () => {
  if (!getApps().length) {
    const serviceAccount = getServiceAccount();
    if (!serviceAccount) {
      throw new Error("Missing Firebase Admin credentials.");
    }

    initializeApp({
      credential: cert(serviceAccount),
    });
  }

  return getFirestore();
};

const verifyRecaptcha = async ({ token, expectedAction }) => {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    throw new Error("Missing reCAPTCHA secret key.");
  }

  const params = new URLSearchParams({
    secret,
    response: token || "",
  });

  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const result = await response.json();
  const minimumScore = Number(process.env.RECAPTCHA_MIN_SCORE || 0.5);

  return Boolean(
    result.success &&
      result.action === expectedAction &&
      typeof result.score === "number" &&
      result.score >= minimumScore
  );
};

export async function POST(request) {
  try {
    if (!isTrustedOrigin(request)) {
      return NextResponse.json({ error: "Invalid submission origin." }, { status: 403 });
    }

    const payload = await readJsonBody(request, 16_384);
    const config = FORM_CONFIG[payload.formType];
    const analytics = normalizeLeadAnalytics(payload.analytics);
    const leadId = analytics.leadId || crypto.randomUUID();
    const leadHash = hashIdentifier(leadId, "website-lead");
    const startedAt = Number(payload.startedAt || 0);
    const elapsed = Date.now() - startedAt;
    if (cleanText(payload.website, 200) || !startedAt || elapsed < 2_500 || elapsed > 86_400_000) {
      return NextResponse.json({ error: "Submission blocked." }, { status: 403 });
    }

    const db = getAdminDb();
    const allowed = await consumeRateLimit({
      db,
      request,
      namespace: "website-lead",
      limit: 5,
      windowMs: 15 * 60_000,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please call (559) 537-6851 for immediate help." },
        { status: 429, headers: { "Retry-After": "900" } }
      );
    }
    if (!config || payload.action !== config.expectedAction) {
      return NextResponse.json({ error: "Invalid form submission." }, { status: 400 });
    }

    const recaptchaOk = await verifyRecaptcha({
      token: payload.token,
      expectedAction: config.expectedAction,
    });
    if (!recaptchaOk) {
      return NextResponse.json({ error: "reCAPTCHA verification failed." }, { status: 403 });
    }

    const { sanitized, errors } = sanitizeLeadForm({
      name: payload.name,
      email: payload.email,
      message: payload.message,
      ...(config.requiresPartNumber ? { partNumber: payload.partNumber } : {}),
    }, {
      messageRequired: config.requiresMessage !== false,
    });
    if (errors.length) {
      return NextResponse.json({ error: errors[0] }, { status: 400 });
    }

    const leadDetails = {
      ...sanitized,
      leadType: config.label,
      sourcePage: cleanPath(payload.sourcePage),
      context: cleanText(payload.context, 200),
    };

    const to = getRecipients();
    if (!to.length) {
      return NextResponse.json({ error: "Email recipients are not configured." }, { status: 500 });
    }

    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const verifiedAnalytics = isProductionAnalyticsRequest(request);
    const mailReference = db.collection("mail").doc(`website-${leadHash}`);
    const eventReference = db.collection("WebsiteAnalyticsEvents").doc(`lead-${leadHash}`);
    const dailyReference = db.collection("WebsiteAnalyticsDaily").doc(date);
    const funnelReference = db.collection("WebsiteLeadFunnels").doc(leadHash);
    const attributedSearchReference = payload.formType === "part_request" && analytics.searchTerm
      ? db
          .collection("WebsitePartSearchDaily")
          .doc(
            `${date}_${crypto
              .createHash("sha256")
              .update(analytics.searchTerm)
              .digest("hex")
              .slice(0, 24)}`
          )
      : null;
    const mailPayload = {
      to,
      message: {
        subject: config.subject,
        text: buildLeadText(leadDetails),
        replyTo: sanitized.email,
        email: sanitized.email,
        partNumber: sanitized.partNumber || null,
        html: buildLeadEmailHtml(leadDetails),
      },
      metadata: {
        leadId: mailReference.id,
        formType: payload.formType,
        createdAt: FieldValue.serverTimestamp(),
        leadType: config.label,
        sourcePage: leadDetails.sourcePage,
        context: leadDetails.context || null,
        acquisitionSource: analytics.acquisitionSource,
        landingPath: analytics.landingPath || null,
        utm: analytics.utm,
        clickIds: analytics.clickIds,
        attributedPartSearch: analytics.searchTerm || null,
      },
    };
    const confirmedSubmissionEvent = {
      eventType: "form_submit",
      date,
      path: leadDetails.sourcePage,
      properties: {
        form_type: payload.formType,
        context: leadDetails.context || "",
        confirmed_by: "lead_api",
        lead_id: leadHash,
        acquisition_source: analytics.acquisitionSource,
        landing_path: analytics.landingPath || "",
        search_term: analytics.searchTerm || "",
      },
      formType: payload.formType,
      referrerHost: analytics.referrerHost || "direct",
      visitorHash: analytics.visitorId
        ? hashIdentifier(analytics.visitorId, "website-visitor")
        : null,
      sessionHash: analytics.sessionId
        ? hashIdentifier(analytics.sessionId, "website-session")
        : null,
      browser: "unknown",
      device: "unknown",
      country: "unknown",
      utm: analytics.utm,
      clickIdPresent: analytics.clickIdPresent,
      acquisitionSource: analytics.acquisitionSource,
      landingPath: cleanPath(analytics.landingPath),
      analyticsVersion: 3,
      trafficClass: "human",
      aggregateVersion: null,
      createdAt: FieldValue.serverTimestamp(),
      clientOccurredAt: "",
      expiresAt: Timestamp.fromMillis(now.getTime() + 90 * 24 * 60 * 60 * 1000),
    };

    let duplicateSubmission = false;
    await db.runTransaction(async (transaction) => {
      const mailSnapshot = await transaction.get(mailReference);
      if (mailSnapshot.exists) {
        duplicateSubmission = true;
        return;
      }
      const dailySnapshot = verifiedAnalytics ? await transaction.get(dailyReference) : null;
      const funnelSnapshot = verifiedAnalytics ? await transaction.get(funnelReference) : null;
      const shouldAggregate = !funnelSnapshot?.get("milestones.form_submit");
      transaction.set(mailReference, mailPayload);
      if (!verifiedAnalytics) return;
      transaction.set(eventReference, confirmedSubmissionEvent);
      transaction.set(
        funnelReference,
        {
          formType: payload.formType,
          source: leadDetails.context || "",
          path: leadDetails.sourcePage,
          acquisitionSource: analytics.acquisitionSource,
          landingPath: cleanPath(analytics.landingPath),
          clickIdPresent: analytics.clickIdPresent,
          sessionHash: confirmedSubmissionEvent.sessionHash,
          visitorHash: confirmedSubmissionEvent.visitorHash,
          milestones: { form_submit: true },
          milestoneDates: { form_submit: date },
          leadDocumentId: mailReference.id,
          createdAt: funnelSnapshot?.exists
            ? funnelSnapshot.get("createdAt") || FieldValue.serverTimestamp()
            : FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      if (attributedSearchReference) {
        transaction.set(
          attributedSearchReference,
          {
            date,
            searchTerm: analytics.searchTerm,
            searchTermNormalized: analytics.searchTerm,
            searchKind: analytics.searchKind || "keyword",
            conversionCount: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
      if (!shouldAggregate) return;
      if (dailySnapshot.exists) {
        transaction.update(dailyReference, {
          "totals.form_submit": FieldValue.increment(1),
          "humanTotals.form_submit": FieldValue.increment(1),
          [`forms.${payload.formType}.form_submit`]: FieldValue.increment(1),
          [`humanForms.${payload.formType}.form_submit`]: FieldValue.increment(1),
          totalEvents: FieldValue.increment(1),
          humanTotalEvents: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        transaction.set(dailyReference, {
          date,
          totalEvents: 1,
          humanTotalEvents: 1,
          totals: { form_submit: 1 },
          humanTotals: { form_submit: 1 },
          forms: { [payload.formType]: { form_submit: 1 } },
          humanForms: { [payload.formType]: { form_submit: 1 } },
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    return NextResponse.json({
      ok: true,
      leadId: mailReference.id,
      duplicate: duplicateSubmission,
    });
  } catch (error) {
    console.error("Lead submission failed:", error);
    return NextResponse.json(
      { error: error.statusCode ? error.message : "Submission failed. Please try again." },
      { status: error.statusCode || 500 }
    );
  }
}
