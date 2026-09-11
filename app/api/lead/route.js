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
import { assessRecaptcha } from "@/app/data/recaptchaPolicy.mjs";
import { formTimingFailure } from "@/app/data/formTiming.mjs";
import { PRODUCTION_HOSTNAME, PRODUCTION_HOST_ALIASES } from "@/site.config.mjs";
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

const getTrafficCountry = (request) => {
  const candidate = cleanText(
    request.headers.get("cf-ipcountry") ||
      request.headers.get("x-vercel-ip-country") ||
      request.headers.get("x-appengine-country") ||
      "unknown",
    8
  ).toUpperCase();
  return /^[A-Z]{2}$/.test(candidate) ? candidate : "unknown";
};

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
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) throw new Error("reCAPTCHA verification service unavailable.");

  const result = await response.json();
  const minimumScore = Number(process.env.RECAPTCHA_MIN_SCORE || 0.5);

  return assessRecaptcha(result, {
    expectedAction,
    minimumScore,
    allowedHosts: [PRODUCTION_HOSTNAME, ...PRODUCTION_HOST_ALIASES,
      ...(process.env.RECAPTCHA_ALLOWED_HOSTS || "").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean),
      ...(process.env.NODE_ENV === "development" ? ["localhost", "127.0.0.1"] : []),
    ],
  });
};

export async function POST(request) {
  try {
    if (!isTrustedOrigin(request)) {
      return NextResponse.json({ error: "Please open this form on advancedimagingparts.com and try again.", code: "invalid_origin" }, { status: 403 });
    }

    const payload = await readJsonBody(request, 16_384);
    const config = FORM_CONFIG[payload.formType];
    const analytics = normalizeLeadAnalytics(payload.analytics);
    const leadId = analytics.leadId || crypto.randomUUID();
    const leadHash = hashIdentifier(leadId, "website-lead");
    if (cleanText(payload.website, 200)) {
      return NextResponse.json({ error: "Submission blocked. Please call (559) 537-6851 for help.", code: "honeypot" }, { status: 403 });
    }
    const timingReason = formTimingFailure({ startedAt: payload.startedAt, formSession: payload.formSession,
      formType: payload.formType, leadId, secret: process.env.RECAPTCHA_SECRET_KEY });
    if (timingReason) {
      console.warn("Lead timing rejected", { reason: timingReason, formType: payload.formType });
      return NextResponse.json({ error: "Please refresh this form and try again, or call (559) 537-6851.", code: "form_timing", timingReason, retryable: true }, { status: 403 });
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

    const verification = await verifyRecaptcha({
      token: payload.token,
      expectedAction: config.expectedAction,
    });
    if (!verification.ok) {
      console.warn("Lead verification rejected", { code: verification.code, formType: payload.formType });
      return NextResponse.json({
        error: "We could not verify this request. Please try again or call (559) 537-6851.",
        code: verification.code,
        retryable: verification.retryable,
      }, { status: 403 });
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

    const trafficCountry = getTrafficCountry(request);
    const reviewFlag = trafficCountry !== "unknown" && trafficCountry !== "US"
      ? "Traffic originated outside the United States"
      : "";

    const leadDetails = {
      ...sanitized,
      leadType: config.label,
      sourcePage: cleanPath(payload.sourcePage),
      context: cleanText(payload.context, 200),
      trafficCountry,
      reviewFlag,
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
        qualificationStatus: "unreviewed",
        sourcePage: leadDetails.sourcePage,
        context: leadDetails.context || null,
        acquisitionSource: analytics.acquisitionSource,
        landingPath: analytics.landingPath || null,
        utm: analytics.utm,
        clickIds: analytics.clickIds,
        attributedPartSearch: analytics.searchTerm || null,
        trafficCountry,
        reviewFlags: reviewFlag ? ["outside_us"] : [],
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
      country: trafficCountry,
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
          country: trafficCountry,
          reviewFlags: reviewFlag ? ["outside_us"] : [],
          sessionHash: confirmedSubmissionEvent.sessionHash,
          visitorHash: confirmedSubmissionEvent.visitorHash,
          milestones: { form_submit: true },
          milestoneDates: { form_submit: date },
          leadDocumentId: mailReference.id,
          qualificationStatus: "unreviewed",
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
      analyticsLeadId: leadHash,
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
