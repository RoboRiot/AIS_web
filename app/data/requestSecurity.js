import crypto from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { PRODUCTION_HOSTNAME, PRODUCTION_HOST_ALIASES } from "../../site.config.mjs";
import {
  isAutomatedUserAgent,
  isProductionAnalyticsHost,
} from "./analyticsPolicy.mjs";
import {
  CATALOG_REQUEST_HEADER,
  CATALOG_REQUEST_VALUE,
} from "./catalogRequestPolicy.mjs";

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

export const getRateLimitFingerprint = (request, namespace, scope = "ip-user-agent") => {
  const clientIp = getClientIp(request);
  if (scope === "ip" && clientIp !== "unknown") {
    return hashIdentifier(clientIp, `${namespace}:ip`);
  }
  return getRequestFingerprint(request, `${namespace}:ip-user-agent`);
};

export const isLikelyAutomation = (request) => {
  const ua = cleanText(request.headers.get("user-agent"), 300);
  return isAutomatedUserAgent(ua);
};

export const isProductionAnalyticsRequest = (request) =>
  isProductionAnalyticsHost(
    request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      ""
  );

export const isTrustedOrigin = (request) => {
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site") return false;

  const origin = request.headers.get("origin");
  if (!origin) return site === "same-origin" || site === "same-site" || site === "none";

  try {
    const originUrl = new URL(origin);
    const requestHost = cleanText(request.headers.get("host"), 255)
      .toLowerCase()
      .replace(/:\d+$/, "");
    const trustedHosts = new Set([
      requestHost,
      PRODUCTION_HOSTNAME,
      ...PRODUCTION_HOST_ALIASES,
    ]);
    return trustedHosts.has(originUrl.hostname.toLowerCase());
  } catch {
    return false;
  }
};

export const isTrustedCatalogRequest = (request) => {
  const marker = cleanText(request.headers.get(CATALOG_REQUEST_HEADER), 40);
  if (marker !== CATALOG_REQUEST_VALUE) return false;

  const accept = cleanText(request.headers.get("accept"), 200).toLowerCase();
  if (!accept.includes("application/json")) return false;

  const fetchSite = cleanText(request.headers.get("sec-fetch-site"), 30).toLowerCase();
  if (fetchSite === "cross-site") return false;

  const origin = request.headers.get("origin");
  return !origin || isTrustedOrigin(request);
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

export const consumeRateLimits = async ({
  db,
  request,
  namespace,
  policies = [],
  now = Date.now(),
}) => {
  const entries = policies.map((policy, index) => {
    const limit = Math.max(1, Math.floor(Number(policy.limit) || 1));
    const windowMs = Math.max(1_000, Math.floor(Number(policy.windowMs) || 60_000));
    const bucket = cleanText(policy.name || `window-${index + 1}`, 40) || `window-${index + 1}`;
    const scope = policy.scope === "ip" ? "ip" : "ip-user-agent";
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const fingerprint = getRateLimitFingerprint(request, `${namespace}:${bucket}`, scope);
    const id = hashIdentifier(
      `${fingerprint}:${windowStart}`,
      `rate:${namespace}:${bucket}`
    );

    return {
      bucket,
      scope,
      limit,
      windowMs,
      windowStart,
      reference: db.collection("WebsiteRateLimits").doc(id),
    };
  });

  if (!entries.length) return { allowed: true, retryAfterSeconds: 0 };

  return db.runTransaction(async (transaction) => {
    const snapshots = [];
    for (const entry of entries) {
      snapshots.push(await transaction.get(entry.reference));
    }

    const blocked = entries.filter((entry, index) =>
      Number(snapshots[index].data()?.count || 0) >= entry.limit
    );
    if (blocked.length) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          ...blocked.map((entry) =>
            Math.max(1, Math.ceil((entry.windowStart + entry.windowMs - now) / 1_000))
          )
        ),
      };
    }

    entries.forEach((entry, index) => {
      const count = Number(snapshots[index].data()?.count || 0);
      transaction.set(entry.reference, {
        namespace,
        bucket: entry.bucket,
        scope: entry.scope,
        count: count + 1,
        windowStartedAt: Timestamp.fromMillis(entry.windowStart),
        expiresAt: Timestamp.fromMillis(entry.windowStart + entry.windowMs * 3),
      }, { merge: true });
    });

    return { allowed: true, retryAfterSeconds: 0 };
  });
};

export const consumeRateLimit = async ({ db, request, namespace, limit, windowMs }) => {
  const result = await consumeRateLimits({
    db,
    request,
    namespace,
    policies: [{ name: "default", limit, windowMs, scope: "ip-user-agent" }],
  });
  return result.allowed;
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
