import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminBucket, getAdminDb } from "@/app/data/firebaseAdmin";
import {
  cleanText,
  consumeRateLimit,
  isTrustedOrigin,
} from "@/app/data/requestSecurity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
const OPERATIONAL_STATUSES = new Set([
  "not_operational",
  "limited",
  "operational",
  "unknown",
]);
const OPERATIONAL_IMPACTS = new Set([
  "scanning_stopped",
  "degraded_performance",
  "intermittent",
  "cosmetic",
  "preventive",
  "other",
]);
const REMOTE_ACCESS_STATUSES = new Set(["available", "unavailable", "unknown"]);
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
  });
  const result = await response.json();
  const minimumScore = Number(process.env.RECAPTCHA_MIN_SCORE || 0.5);
  return Boolean(
    result.success &&
      result.action === expectedAction &&
      Number(result.score) >= minimumScore
  );
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
  equipmentOperational: oneOf(
    formData.get("equipmentOperational"),
    OPERATIONAL_STATUSES
  ),
  operationalImpact: oneOf(formData.get("operationalImpact"), OPERATIONAL_IMPACTS),
  remoteAccess: oneOf(formData.get("remoteAccess"), REMOTE_ACCESS_STATUSES),
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
    ["equipmentOperational", "Equipment operational status"],
    ["operationalImpact", "Operational impact"],
    ["remoteAccess", "Remote access status"],
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
        "Too many requests. Please call (800) 200-3583 for immediate help.",
        429,
        { "Retry-After": "1800" }
      );
    }

    const formData = await request.formData();
    const startedAt = Number(formData.get("startedAt") || 0);
    const elapsed = Date.now() - startedAt;
    if (
      cleanText(formData.get("website"), 200) ||
      !startedAt ||
      elapsed < 2_500 ||
      elapsed > 86_400_000 ||
      formData.get("action") !== "service_request"
    ) {
      return fail("Submission blocked.", 403);
    }

    const recaptchaOk = await verifyRecaptcha({
      token: cleanText(formData.get("token"), 10_000),
      expectedAction: "service_request",
    });
    if (!recaptchaOk) return fail("reCAPTCHA verification failed.", 403);

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

    const requestReference = db.collection("ServiceRequests").doc();
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

    await requestReference.set({
      ...payload,
      requestNumber,
      locationText,
      contactName: `${payload.firstName} ${payload.lastName}`.trim(),
      files: attachmentRecords,
      status: "pending",
      source: "ais_website",
      clientMatchStatus: "pending",
      suggestedClient: null,
      confirmedClient: null,
      blueFolder: null,
      magmo: null,
      processing: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json(
      { ok: true, requestId: requestReference.id, requestNumber },
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
