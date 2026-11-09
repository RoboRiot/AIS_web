import { createHash, randomUUID } from "node:crypto";
import { PRODUCTION_SITE_URL } from "../../site.config.mjs";
import { OPENAI_CONVERSIONS_PIXEL_ID, normalizeOpenAiClickId } from "./openAiConversionsConfig.mjs";

const EVENT_MAX_AGE_MS = 7 * 24 * 60 * 60_000;
const REQUEST_TIMEOUT_MS = 2_500;
const LEASE_MS = 15_000;
const MAX_ATTEMPTS = 4;
const RETRY_DELAY_MS = 30_000;
const FORM_TYPES = new Set(["service_request", "trailer_request"]);
const clickFingerprint = (value) => createHash("sha256").update(value).digest("hex");
const ALLOWED_PATH = /^\/(?:contact|service-request|services\/(?:mri|ct|pet-ct|(?:ge|siemens|toshiba)-(?:mri|ct|pet-ct))-service|trailers\/(?:mobile-(?:mri|ct|pet-ct)|(?:ge|siemens|toshiba)-(?:mri|ct|pet-ct))-trailer-rental)$/;

export function getOpenAiConversionsConfig(env = process.env) {
  const pixelId = env.OPENAI_CONVERSIONS_PIXEL_ID || OPENAI_CONVERSIONS_PIXEL_ID;
  const apiKey = env.OPENAI_CONVERSIONS_API_KEY;
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(pixelId) || typeof apiKey !== "string" || !apiKey.trim()) return null;
  return { pixelId, apiKey };
}

export function canMeasureOpenAiLead({ analytics, formType, productionEligible }) {
  return productionEligible === true && FORM_TYPES.has(formType) &&
    analytics?.measurement?.eligibility === "eligible" &&
    analytics?.measurement?.marketingConsent === "granted" &&
    Boolean(normalizeOpenAiClickId(analytics?.openAiClickId));
}

function publicSourceUrl(value) {
  // Only fixed public service/contact paths leave the server. No query, free text,
  // account URL, request number, or customer-supplied URL is forwarded.
  const path = typeof value === "string" ? value.split(/[?#]/)[0] : "";
  return `${PRODUCTION_SITE_URL}${ALLOWED_PATH.test(path) ? path : "/contact"}`;
}

export function createOpenAiConversion({ analytics, formType, productionEligible, leadId,
  sourcePage, now = Date.now(), config = getOpenAiConversionsConfig() }) {
  if (!config || !canMeasureOpenAiLead({ analytics, formType, productionEligible }) ||
      !/^[a-z0-9][a-z0-9-]{7,99}$/.test(leadId || "") || !Number.isSafeInteger(now)) return null;
  return {
    version: 1,
    pixelId: config.pixelId,
    status: "pending",
    attempts: 0,
    nextAttemptAt: now,
    leaseUntil: 0,
    // Keep only a fingerprint for matching a consented retry. The original
    // opaque reference is forwarded in memory and is never stored in this doc.
    clickIdFingerprint: clickFingerprint(analytics.openAiClickId),
    event: {
      id: `ais_lead_${leadId}`,
      type: "lead_created",
      timestamp_ms: now,
      source_url: publicSourceUrl(sourcePage),
      action_source: "web",
      opt_out: true,
      data: { type: "customer_action" },
    },
  };
}

function completedRecord(record) {
  return { ...record, clickIdFingerprint: "" };
}

function isAcceptedLead(data) {
  return data?.eventType === "form_submit" && FORM_TYPES.has(data.formType) &&
    ["lead_api", "service_request_api"].includes(data.properties?.confirmed_by) &&
    data.measurement?.eligibility === "eligible" && data.measurement?.marketingConsent === "granted";
}

async function claimDelivery({ db, eventReference, config, oppref, now }) {
  const owner = randomUUID();
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(eventReference);
    const data = snapshot.exists ? snapshot.data() : null;
    const record = data?.openAiConversion;
    if (!isAcceptedLead(data) || record?.version !== 1 || record.pixelId !== config.pixelId ||
        !["pending", "sending"].includes(record.status) ||
        record.clickIdFingerprint !== clickFingerprint(oppref)) return null;
    if (record.leaseUntil > now || record.nextAttemptAt > now) return null;
    if (!Number.isSafeInteger(record.event?.timestamp_ms) || now - record.event.timestamp_ms > EVENT_MAX_AGE_MS ||
        record.event.timestamp_ms > now + 10 * 60_000 || record.attempts >= MAX_ATTEMPTS) {
      transaction.update(eventReference, { openAiConversion: {
        ...completedRecord(record), status: "expired", leaseUntil: 0, updatedAt: now,
      } });
      return null;
    }
    const claimed = { ...record, status: "sending", attempts: record.attempts + 1,
      leaseOwner: owner, leaseUntil: now + LEASE_MS, updatedAt: now };
    transaction.update(eventReference, { openAiConversion: claimed });
    return claimed;
  });
}

async function finishDelivery({ db, eventReference, claimed, status, httpStatus, retryAt, now }) {
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(eventReference);
    const current = snapshot.exists ? snapshot.get("openAiConversion") : null;
    if (current?.leaseOwner !== claimed.leaseOwner) return false;
    const next = { ...current, status, leaseOwner: "", leaseUntil: 0, updatedAt: now,
      lastHttpStatus: httpStatus, nextAttemptAt: retryAt };
    transaction.update(eventReference, { openAiConversion: status === "pending" ? next : completedRecord(next) });
    return true;
  });
}

// Called only after the lead has been persisted. All failures stay isolated from
// the customer's accepted response. Pending delivery can resume on a confirmed
// retry of that same inquiry; no background jobs or historical backfills run.
export async function deliverOpenAiConversion({ db, eventReference, allowed, oppref,
  config = getOpenAiConversionsConfig(), fetchImpl = fetch, now = Date.now,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  const clickId = normalizeOpenAiClickId(oppref);
  if (!allowed || !config || !clickId) return { status: "disabled" };
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const claimed = await claimDelivery({ db, eventReference, config, oppref: clickId, now: now() });
      if (!claimed) return { status: "not_due" };
      let httpStatus = 0;
      let retryAfterMs = 0;
      try {
        const response = await fetchImpl(`https://bzr.openai.com/v1/events?pid=${encodeURIComponent(config.pixelId)}`, {
          method: "POST", redirect: "error", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ validate_only: false, events: [{
            id: claimed.event.id,
            type: "lead_created",
            timestamp_ms: claimed.event.timestamp_ms,
            oppref: clickId,
            source_url: claimed.event.source_url,
            action_source: "web",
            opt_out: true,
            data: { type: "customer_action" },
          }] }),
        });
        httpStatus = response.status;
        const retryAfter = response.headers?.get("retry-after");
        if (retryAfter) {
          const seconds = Number(retryAfter);
          const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - now();
          if (Number.isFinite(delay)) retryAfterMs = Math.max(0, delay);
        }
        // Do not read, log, or persist response bodies; they may echo identifiers.
        await response.body?.cancel?.().catch(() => {});
      } catch { /* Only a coarse delivery status is retained. Never log credentials or events. */ }
      const accepted = httpStatus >= 200 && httpStatus < 300;
      const retryable = httpStatus === 0 || httpStatus === 408 || httpStatus === 429 || httpStatus >= 500;
      const retry = !accepted && retryable && claimed.attempts < MAX_ATTEMPTS;
      const immediate = retry && attempt === 0 && retryAfterMs <= 250;
      const retryAt = retry ? now() + (immediate ? 250 : Math.max(RETRY_DELAY_MS, retryAfterMs)) : 0;
      const status = accepted ? "accepted" : retry ? "pending" : "rejected";
      await finishDelivery({ db, eventReference, claimed, status, httpStatus, retryAt, now: now() });
      if (!immediate) return { status };
      await wait(250);
    }
    return { status: "pending" };
  } catch {
    // A delivery/Firestore outage must not cause a second inquiry or attachment cleanup.
    return { status: "unavailable" };
  }
}
