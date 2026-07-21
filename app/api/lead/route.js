import { NextResponse } from "next/server";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import {
  buildLeadEmailHtml,
  buildLeadText,
  sanitizeLeadForm,
} from "@/components/utils/formSecurity";
import {
  cleanPath,
  cleanText,
  consumeRateLimit,
  isTrustedOrigin,
  readJsonBody,
} from "@/app/data/requestSecurity";
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
        { error: "Too many requests. Please call (800) 200-3583 for immediate help." },
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

    await db.collection("mail").add({
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
        formType: payload.formType,
        createdAt: FieldValue.serverTimestamp(),
        leadType: config.label,
        sourcePage: leadDetails.sourcePage,
        context: leadDetails.context || null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Lead submission failed:", error);
    return NextResponse.json(
      { error: error.statusCode ? error.message : "Submission failed. Please try again." },
      { status: error.statusCode || 500 }
    );
  }
}
