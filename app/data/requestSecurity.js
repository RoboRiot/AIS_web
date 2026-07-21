import crypto from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";

const AUTOMATION_UA = [
  "python-requests",
  "scrapy",
  "go-http-client",
  "libwww",
  "phantomjs",
  "selenium",
  "headlesschrome",
];

const securitySecret = () =>
  process.env.ANALYTICS_HASH_SALT ||
  process.env.RECAPTCHA_SECRET_KEY ||
  process.env.FIREBASE_PRIVATE_KEY ||
  "ais-local-security-key";

export const cleanText = (value, maxLength = 120) =>
  String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

export const cleanPath = (value) => {
  const candidate = cleanText(value, 300);
  if (!candidate.startsWith("/")) return "/";
  return candidate.split("#")[0].slice(0, 300);
};

export const getClientIp = (request) =>
  cleanText(
    request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-appengine-user-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown",
    80
  );

export const hashIdentifier = (value, namespace = "default") =>
  crypto
    .createHmac("sha256", securitySecret())
    .update(`${namespace}:${cleanText(value, 500)}`)
    .digest("hex")
    .slice(0, 32);

export const getRequestFingerprint = (request, namespace) => {
  const ua = cleanText(request.headers.get("user-agent"), 300);
  return hashIdentifier(`${getClientIp(request)}|${ua}`, namespace);
};

export const isLikelyAutomation = (request) => {
  const ua = cleanText(request.headers.get("user-agent"), 300).toLowerCase();
  return !ua || AUTOMATION_UA.some((pattern) => ua.includes(pattern));
};

export const isTrustedOrigin = (request) => {
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site") return false;

  const origin = request.headers.get("origin");
  if (!origin) return site === "same-origin" || site === "same-site" || site === "none";

  try {
    const originUrl = new URL(origin);
    const requestHost = request.headers.get("host");
    const productionHost = new URL(
      process.env.NEXT_PUBLIC_SITE_URL || "https://advancedimagingparts.com"
    ).host;
    return originUrl.host === requestHost || originUrl.host === productionHost;
  } catch {
    return false;
  }
};

export const readJsonBody = async (request, maxBytes = 16_384) => {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > maxBytes) {
    const error = new Error("Request is too large.");
    error.statusCode = 413;
    throw error;
  }

  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    const error = new Error("Request is too large.");
    error.statusCode = 413;
    throw error;
  }

  try {
    return JSON.parse(text || "{}");
  } catch {
    const error = new Error("Invalid JSON request.");
    error.statusCode = 400;
    throw error;
  }
};

export const consumeRateLimit = async ({ db, request, namespace, limit, windowMs }) => {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const fingerprint = getRequestFingerprint(request, namespace);
  const id = hashIdentifier(`${fingerprint}:${windowStart}`, `rate:${namespace}`);
  const reference = db.collection("WebsiteRateLimits").doc(id);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const count = Number(snapshot.data()?.count || 0);
    if (count >= limit) return false;
    transaction.set(reference, {
      namespace,
      count: count + 1,
      windowStartedAt: Timestamp.fromMillis(windowStart),
      expiresAt: Timestamp.fromMillis(windowStart + windowMs * 3),
    }, { merge: true });
    return true;
  });
};

export const signCursor = (payload) => {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", securitySecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
};

export const verifyCursor = (value) => {
  const [encoded, signature] = cleanText(value, 1000).split(".");
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac("sha256", securitySecret()).update(encoded).digest("base64url");
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
};
