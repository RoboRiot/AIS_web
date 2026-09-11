import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminBucket, getAdminDb } from "@/app/data/firebaseAdmin";
import {
  cleanText,
  cleanPath,
  consumeRateLimit,
  hashIdentifier,
  isProductionAnalyticsRequest,
  isTrustedOrigin,
} from "@/app/data/requestSecurity";
import { normalizeLeadAnalytics } from "@/app/data/leadAnalytics.mjs";
import { formTimingFailure } from "@/app/data/formTiming.mjs";
import { assessRecaptcha } from "@/app/data/recaptchaPolicy.mjs";
import { PRODUCTION_HOSTNAME, PRODUCTION_HOST_ALIASES } from "@/site.config.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

const MAX_REQUEST_BYTES = 28 * 1024 * 1024;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_FILE_BYTES = 25 * 1024 * 1024;
const MAX_FILES = 5;

const MANUFACTURERS = new Set([
  "GE Healthcare",
  "Siemens Healthineers",
  "Philips Healthcare",
  "Toshiba",
]);
const MODALITIES = new Set([
  "MRI",
  "Computed Tomography CT",
  "Mammography",
  "X-ray",
  "PETCT",
  "Nucmed",
]);
const URGENCIES = new Set(["hard_down", "asap", "soon", "anytime"]);
const FILE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
  "text/plain",
]);

const fail = (message, status = 400, headers) =>
  NextResponse.json({ error: message }, { status, headers });

const cleanMultiline = (value, maxLength) =>
  String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trimEnd())
    .join("\n")
    .trim()
    .slice(0, maxLength);

const oneOf = (value, values) => {
  const candidate = cleanText(value, 100);
  return values.has(candidate) ? candidate : "";
};

const verifyRecaptcha = async ({ token, expectedAction }) => {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) throw new Error("Missing reCAPTCHA secret key.");

  const params = new URLSearchParams({
    secret,
    response: token || "",
  });
  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("reCAPTCHA verification service unavailable.");
  const result = await response.json();
  const minimumScore = Number(process.env.RECAPTCHA_MIN_SCORE || 0.5);
  return assessRecaptcha(result, {
    expectedAction, minimumScore,
    allowedHosts: [PRODUCTION_HOSTNAME, ...PRODUCTION_HOST_ALIASES,
      ...(process.env.RECAPTCHA_ALLOWED_HOSTS || "").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean),
      ...(process.env.NODE_ENV === "development" ? ["localhost", "127.0.0.1"] : []),
    ],
  });
};

const hasBytes = (buffer, offset, bytes) =>
  bytes.every((byte, index) => buffer[offset + index] === byte);

const hasAscii = (buffer, offset, value) =>
  buffer.subarray(offset, offset + value.length).toString("ascii") === value;

const validFileSignature = (buffer, contentType) => {
  if (!buffer.length) return false;
  if (contentType === "image/jpeg") {
    return hasBytes(buffer, 0, [0xff, 0xd8, 0xff]);
  }
  if (contentType === "image/png") {
    return hasBytes(buffer, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  if (contentType === "image/webp") {
    return hasAscii(buffer, 0, "RIFF") && hasAscii(buffer, 8, "WEBP");
  }
  if (contentType === "image/heic" || contentType === "image/heif") {
    const brand = buffer.subarray(8, 16).toString("ascii").toLowerCase();
    return hasAscii(buffer, 4, "ftyp") && /(heic|heix|hevc|hevx|mif1|msf1)/.test(brand);
  }
  if (contentType === "application/pdf") {
    return hasAscii(buffer, 0, "%PDF-");
  }
  if (contentType === "text/plain") {
    return !buffer.includes(0);
  }
  return false;
};

const safeFileName = (value) => {
  const cleaned = String(value || "attachment")
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 100);
  return cleaned || "attachment";
};

const sanitizePayload = (formData) => ({
  companyName: cleanText(formData.get("companyName"), 120),
  requestedServiceDate: cleanText(formData.get("requestedServiceDate"), 10),
  streetAddress: cleanText(formData.get("streetAddress"), 160),
  addressLine2: cleanText(formData.get("addressLine2"), 120),
  city: cleanText(formData.get("city"), 80),
  region: cleanText(formData.get("region"), 80),
  postalCode: cleanText(formData.get("postalCode"), 20),
  country: cleanText(formData.get("country"), 80),
  urgency: oneOf(formData.get("urgency"), URGENCIES),
  manufacturer: oneOf(formData.get("manufacturer"), MANUFACTURERS),
  modality: oneOf(formData.get("modality"), MODALITIES),
  firstName: cleanText(formData.get("firstName"), 60),
  lastName: cleanText(formData.get("lastName"), 60),
  phone: cleanText(formData.get("phone"), 30),
  email: cleanText(formData.get("email"), 120).toLowerCase(),
  purchaseOrderNumber: cleanText(formData.get("purchaseOrderNumber"), 50),
  issueTitle: cleanText(formData.get("issueTitle"), 100),
  systemModel: cleanText(formData.get("systemModel"), 160),
  requestedTiming: cleanText(formData.get("requestedTiming"), 240),
  description: cleanMultiline(formData.get("description"), 4000),
});

const validationError = (payload) => {
  const required = [
    ["companyName", "Company name"],
    ["requestedServiceDate", "Service request date"],
    ["streetAddress", "Equipment location"],
    ["city", "City"],
    ["region", "State, province, or region"],
    ["postalCode", "Postal or zip code"],
    ["country", "Country"],
    ["urgency", "Urgency"],
    ["manufacturer", "Manufacturer"],
    ["modality", "Modality"],
    ["firstName", "First name"],
    ["lastName", "Last name"],
    ["phone", "Contact number"],
    ["email", "Email"],
    ["issueTitle", "Issue title"],
    ["description", "Issue description"],
  ];
  const missing = required.find(([key]) => !payload[key]);
  if (missing) return `${missing[1]} is required.`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.requestedServiceDate)) {
    return "Enter a valid service request date.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    return "Enter a valid email address.";
  }
  if (payload.phone.replace(/\D/g, "").length < 7) {
    return "Enter a valid contact number.";
  }
  return "";
};

export async function POST(request) {
  const uploadedPaths = [];
  try {
    if (!isTrustedOrigin(request)) return fail("Invalid submission origin.", 403);

    const declaredLength = Number(request.headers.get("content-length") || 0);
    if (declaredLength > MAX_REQUEST_BYTES) {
      return fail("The request and attachments are too large.", 413);
    }

    const db = getAdminDb();
    const allowed = await consumeRateLimit({
      db,
      request,
      namespace: "website-service-request",
      limit: 3,
      windowMs: 30 * 60_000,
    });
    if (!allowed) {
      return fail(
        "Too many requests. Please call (559) 537-6851 for immediate help.",
        429,
        { "Retry-After": "1800" }
      );
    }

    const formData = await request.formData();
    let rawAnalytics = {};
    try {
      rawAnalytics = JSON.parse(String(formData.get("analytics") || "{}"));
    } catch {
      rawAnalytics = {};
    }
    const analytics = normalizeLeadAnalytics(rawAnalytics);
    const leadId = analytics.leadId || crypto.randomUUID();
    const leadHash = hashIdentifier(leadId, "website-lead");
    if (
      cleanText(formData.get("website"), 200) ||
      formData.get("action") !== "service_request"
    ) {
      return fail("Submission blocked.", 403);
    }
    const timingReason = formTimingFailure({ startedAt: formData.get("startedAt"), formSession: formData.get("formSession"),
      formType: "service_request", leadId, secret: process.env.RECAPTCHA_SECRET_KEY });
    if (timingReason) {
      console.warn("Service request timing rejected", { reason: timingReason });
      return NextResponse.json({ error: "Please refresh this form and try again.", code: "form_timing", timingReason, retryable: true }, { status: 403 });
    }

    const recaptchaOk = await verifyRecaptcha({
      token: cleanText(formData.get("token"), 10_000),
      expectedAction: "service_request",
    });
    if (!recaptchaOk.ok) return NextResponse.json({ error: "reCAPTCHA verification failed.",
      code: recaptchaOk.code, retryable: recaptchaOk.retryable }, { status: 403 });

    const payload = sanitizePayload(formData);
    const invalid = validationError(payload);
    if (invalid) return fail(invalid);

    const submittedFiles = formData
      .getAll("files")
      .filter((item) => item && typeof item.arrayBuffer === "function" && item.size);
    if (submittedFiles.length > MAX_FILES) {
      return fail(`You can attach up to ${MAX_FILES} files.`, 413);
    }
    const totalBytes = submittedFiles.reduce(
      (sum, file) => sum + Number(file.size || 0),
      0
    );
    if (totalBytes > MAX_TOTAL_FILE_BYTES) {
      return fail("Attachments can total no more than 25 MB.", 413);
    }

    const requestReference = db.collection("ServiceRequests").doc(`web-${leadHash}`);
    const existingRequest = await requestReference.get();
    if (existingRequest.exists) {
      return NextResponse.json(
        {
          ok: true,
          duplicate: true,
          analyticsLeadId: leadHash,
          requestId: requestReference.id,
          requestNumber: existingRequest.get("requestNumber"),
        },
        { status: 200 }
      );
    }
    const requestNumber = `SR-${requestReference.id.slice(0, 8).toUpperCase()}`;
    const bucket = getAdminBucket();
    const attachmentRecords = [];

    for (const file of submittedFiles) {
      const contentType = cleanText(file.type, 100).toLowerCase();
      if (!FILE_TYPES.has(contentType)) {
        return fail(`${safeFileName(file.name)} is not a supported file type.`);
      }
      if (file.size > MAX_FILE_BYTES) {
        return fail(`${safeFileName(file.name)} is larger than 8 MB.`, 413);
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      if (buffer.length !== file.size || !validFileSignature(buffer, contentType)) {
        return fail(`${safeFileName(file.name)} could not be verified as a safe file.`);
      }

      const originalName = safeFileName(file.name);
      const storagePath =
        `service-requests/${requestReference.id}/` +
        `${crypto.randomUUID()}-${originalName}`;
      const bucketFile = bucket.file(storagePath);
      await bucketFile.save(buffer, {
        resumable: false,
        validation: "crc32c",
        metadata: {
          contentType,
          contentDisposition: `attachment; filename="${originalName.replace(/"/g, "")}"`,
          cacheControl: "private, max-age=0, no-store",
          metadata: {
            serviceRequestId: requestReference.id,
            requestNumber,
          },
        },
      });
      uploadedPaths.push(storagePath);
      attachmentRecords.push({
        name: originalName,
        storagePath,
        contentType,
        size: buffer.length,
        blueFolderAttachmentId: null,
      });
    }

    const locationText = [
      payload.streetAddress,
      payload.addressLine2,
      payload.city,
      payload.region,
      payload.postalCode,
      payload.country,
    ]
      .filter(Boolean)
      .join(", ");

    const trafficCountry = getTrafficCountry(request);
    const reviewFlags = trafficCountry !== "unknown" && trafficCountry !== "US"
      ? ["outside_us"]
      : [];

    await requestReference.set({
      ...payload,
      requestNumber,
      locationText,
      contactName: `${payload.firstName} ${payload.lastName}`.trim(),
      files: attachmentRecords,
      status: "pending",
      source: "ais_website",
      trafficCountry,
      reviewFlags,
      clientMatchStatus: "pending",
      suggestedClient: null,
      confirmedClient: null,
      blueFolder: null,
      magmo: null,
      processing: null,
      analytics: {
        acquisitionSource: analytics.acquisitionSource,
        landingPath: cleanPath(analytics.landingPath),
        sourcePage: cleanPath(analytics.sourcePage),
        referrerHost: analytics.referrerHost || "direct",
        utm: analytics.utm,
        clickIds: analytics.clickIds,
        clickIdPresent: analytics.clickIdPresent,
        visitorHash: analytics.visitorId
          ? hashIdentifier(analytics.visitorId, "website-visitor")
          : null,
        sessionHash: analytics.sessionId
          ? hashIdentifier(analytics.sessionId, "website-session")
          : null,
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (isProductionAnalyticsRequest(request)) {
      try {
        const now = new Date();
        const date = now.toISOString().slice(0, 10);
        const dailyReference = db.collection("WebsiteAnalyticsDaily").doc(date);
        const funnelReference = db.collection("WebsiteLeadFunnels").doc(leadHash);
        const eventReference = db.collection("WebsiteAnalyticsEvents").doc(`lead-${leadHash}`);
        const sessionHash = analytics.sessionId
          ? hashIdentifier(analytics.sessionId, "website-session")
          : null;
        const visitorHash = analytics.visitorId
          ? hashIdentifier(analytics.visitorId, "website-visitor")
          : null;

        await db.runTransaction(async (transaction) => {
          const dailySnapshot = await transaction.get(dailyReference);
          const funnelSnapshot = await transaction.get(funnelReference);
          const shouldAggregate = !funnelSnapshot.get("milestones.form_submit");
          transaction.set(eventReference, {
            eventType: "form_submit",
            date,
            path: cleanPath(analytics.sourcePage || "/service-request"),
            properties: {
              form_type: "service_request",
              context: requestNumber,
              confirmed_by: "service_request_api",
              lead_id: leadHash,
              acquisition_source: analytics.acquisitionSource,
              landing_path: analytics.landingPath || "",
            },
            formType: "service_request",
            referrerHost: analytics.referrerHost || "direct",
            visitorHash,
            sessionHash,
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
          });
          transaction.set(
            funnelReference,
            {
              formType: "service_request",
              source: "service_request_page",
              path: cleanPath(analytics.sourcePage || "/service-request"),
              acquisitionSource: analytics.acquisitionSource,
              landingPath: cleanPath(analytics.landingPath),
              clickIdPresent: analytics.clickIdPresent,
              country: trafficCountry,
              reviewFlags,
              sessionHash,
              visitorHash,
              milestones: { form_submit: true },
              milestoneDates: { form_submit: date },
              leadDocumentId: requestReference.id,
              createdAt: funnelSnapshot.exists
                ? funnelSnapshot.get("createdAt") || FieldValue.serverTimestamp()
                : FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          if (!shouldAggregate) return;
          if (dailySnapshot.exists) {
            transaction.update(dailyReference, {
              "totals.form_submit": FieldValue.increment(1),
              "humanTotals.form_submit": FieldValue.increment(1),
              "forms.service_request.form_submit": FieldValue.increment(1),
              "humanForms.service_request.form_submit": FieldValue.increment(1),
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
              forms: { service_request: { form_submit: 1 } },
              humanForms: { service_request: { form_submit: 1 } },
              createdAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
        });
      } catch (analyticsError) {
        console.error("Service request analytics failed:", analyticsError);
      }
    }

    return NextResponse.json(
      { ok: true, requestId: requestReference.id, requestNumber, analyticsLeadId: leadHash },
      { status: 201 }
    );
  } catch (error) {
    console.error("Service request submission failed:", error);
    if (uploadedPaths.length) {
      try {
        const bucket = getAdminBucket();
        await Promise.all(
          uploadedPaths.map((storagePath) =>
            bucket.file(storagePath).delete({ ignoreNotFound: true })
          )
        );
      } catch (cleanupError) {
        console.error("Service request attachment cleanup failed:", cleanupError);
      }
    }
    return fail(
      error?.statusCode ? error.message : "Submission failed. Please try again.",
      error?.statusCode || 500
    );
  }
}
