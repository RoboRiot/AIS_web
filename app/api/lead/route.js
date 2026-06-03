import { NextResponse } from "next/server";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import {
  buildLeadEmailHtml,
  buildLeadText,
  sanitizeLeadForm,
} from "@/components/utils/formSecurity";

const FORM_CONFIG = {
  contact_form: {
    expectedAction: "contact_form",
    subject: "Contact Form Submission | Advanced Imaging",
    requiresPartNumber: false,
  },
  part_request: {
    expectedAction: "part_request",
    subject: "Part Request Form | Advanced Imaging",
    requiresPartNumber: true,
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
    const payload = await request.json();
    const config = FORM_CONFIG[payload.formType];
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
      partNumber: config.requiresPartNumber ? payload.partNumber : null,
      message: payload.message,
    });
    if (errors.length) {
      return NextResponse.json({ error: errors[0] }, { status: 400 });
    }

    const to = getRecipients();
    if (!to.length) {
      return NextResponse.json({ error: "Email recipients are not configured." }, { status: 500 });
    }

    const db = getAdminDb();
    await db.collection("mail").add({
      to,
      message: {
        subject: config.subject,
        text: buildLeadText(sanitized),
        email: sanitized.email,
        partNumber: sanitized.partNumber || null,
        html: buildLeadEmailHtml(sanitized),
      },
      metadata: {
        formType: payload.formType,
        createdAt: FieldValue.serverTimestamp(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Lead submission failed:", error);
    return NextResponse.json({ error: "Submission failed. Please try again." }, { status: 500 });
  }
}
