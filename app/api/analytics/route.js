import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/app/data/firebaseAdmin";
import {
  cleanPath,
  cleanText,
  consumeRateLimit,
  hashIdentifier,
  isLikelyAutomation,
  isTrustedOrigin,
  readJsonBody,
} from "@/app/data/requestSecurity";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";


const EVENT_TYPES = new Set([
  "page_view",
  "click",
  "search",
  "filter",
  "product_view",
  "product_select",
  "form_open",
  "form_start",
  "form_submit",
  "form_error",
]);
const FORM_TYPES = new Set(["contact_form", "part_request", "service_request", "trailer_request"]);

const redact = (value) =>
  cleanText(value, 140)
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[redacted-email]")
    .replace(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, "[redacted-phone]");

const safeProperties = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, item]) =>
        /^[a-z][a-z0-9_]{0,39}$/i.test(key) &&
        ["string", "number", "boolean"].includes(typeof item)
      )
      .slice(0, 16)
      .map(([key, item]) => [key, typeof item === "string" ? redact(item) : item])
  );
};

const browserFamily = (userAgent) => {
  if (/edg\//i.test(userAgent)) return "Edge";
  if (/firefox\//i.test(userAgent)) return "Firefox";
  if (/chrome\//i.test(userAgent)) return "Chrome";
  if (/safari\//i.test(userAgent)) return "Safari";
  return "Other";
};

const deviceFamily = (userAgent) => {
  if (/ipad|tablet/i.test(userAgent)) return "tablet";
  if (/mobile|iphone|android/i.test(userAgent)) return "mobile";
  return "desktop";
};

const referrerHost = (value) => {
  try {
    return new URL(cleanText(value, 300)).hostname.slice(0, 120);
  } catch {
    return "direct";
  }
};

export async function POST(request) {
  try {
    if (!isTrustedOrigin(request) || isLikelyAutomation(request)) {
      return NextResponse.json({ error: "Event rejected." }, { status: 403 });
    }

    const payload = await readJsonBody(request, 12_000);
    const eventType = cleanText(payload.eventType, 40);
    if (!EVENT_TYPES.has(eventType)) {
      return NextResponse.json({ error: "Invalid event." }, { status: 400 });
    }

    const db = getAdminDb();
    const allowed = await consumeRateLimit({
      db,
      request,
      namespace: "website-analytics",
      limit: 180,
      windowMs: 60_000,
    });
    if (!allowed) {
      return NextResponse.json({ error: "Event rate exceeded." }, { status: 429 });
    }

    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const properties = safeProperties(payload.properties);
    const formType = FORM_TYPES.has(properties.form_type) ? properties.form_type : "";
    const userAgent = cleanText(request.headers.get("user-agent"), 300);
    const rawPath = cleanPath(payload.path);
    const pathUrl = new URL(rawPath, "https://advancedimagingparts.com");
    const event = {
      eventType,
      date,
      path: pathUrl.pathname,
      properties,
      formType: formType || null,
      referrerHost: referrerHost(payload.referrer || request.headers.get("referer")),
      visitorHash: hashIdentifier(payload.visitorId, "website-visitor"),
      sessionHash: hashIdentifier(payload.sessionId, "website-session"),
      browser: browserFamily(userAgent),
      device: deviceFamily(userAgent),
      country: cleanText(
        request.headers.get("x-appengine-country") || request.headers.get("cf-ipcountry") || "unknown",
        8
      ),
      utm: {
        source: cleanText(pathUrl.searchParams.get("utm_source"), 80),
        medium: cleanText(pathUrl.searchParams.get("utm_medium"), 80),
        campaign: cleanText(pathUrl.searchParams.get("utm_campaign"), 100),
      },
      createdAt: FieldValue.serverTimestamp(),
      clientOccurredAt: cleanText(payload.occurredAt, 40),
      expiresAt: Timestamp.fromMillis(now.getTime() + 90 * 24 * 60 * 60 * 1000),
    };

    const eventReference = db.collection("WebsiteAnalyticsEvents").doc();
    const dailyReference = db.collection("WebsiteAnalyticsDaily").doc(date);
    await db.runTransaction(async (transaction) => {
      const dailySnapshot = await transaction.get(dailyReference);
      transaction.set(eventReference, event);
      if (dailySnapshot.exists) {
        const updates = {
          [`totals.${eventType}`]: FieldValue.increment(1),
          totalEvents: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        };
        if (formType) updates[`forms.${formType}.${eventType}`] = FieldValue.increment(1);
        transaction.update(dailyReference, updates);
      } else {
        transaction.set(dailyReference, {
          date,
          totalEvents: 1,
          totals: { [eventType]: 1 },
          forms: formType ? { [formType]: { [eventType]: 1 } } : {},
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    return new NextResponse(null, {
      status: 202,
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
    });
  } catch (error) {
    console.error("Website analytics event failed:", error);
    return NextResponse.json(
      { error: error.statusCode ? error.message : "Event could not be recorded." },
      { status: error.statusCode || 500 }
    );
  }
}
