import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const MIN_FORM_AGE_MS = 2_500;
export const MAX_FORM_AGE_MS = 86_400_000;
const signature = (body, secret) => createHmac("sha256", secret).update(`ais-form-session-v1:${body}`).digest("base64url");

export function createFormSession({ formType, leadId, secret, now = Date.now() }) {
  if (!secret) throw new Error("Form session signing is not configured.");
  const body = Buffer.from(JSON.stringify({ formType, leadId, issuedAt: now, nonce: randomUUID() })).toString("base64url");
  return `${body}.${signature(body, secret)}`;
}

export function formTimingFailure({ startedAt, formSession, formType, leadId, secret, now = Date.now() }) {
  let issuedAt = Number(startedAt);
  if (formSession) {
    if (!secret || typeof formSession !== "string" || formSession.length > 1_024) return "invalid_session";
    try {
      const [body, mac, extra] = formSession.split(".");
      const expected = signature(body, secret);
      if (extra || !mac || mac.length !== expected.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return "invalid_session";
      const session = JSON.parse(Buffer.from(body, "base64url").toString());
      if (session.formType !== formType || session.leadId !== leadId) return "invalid_session";
      issuedAt = session.issuedAt;
    } catch { return "invalid_session"; }
  }
  const elapsed = now - issuedAt;
  if (!Number.isFinite(issuedAt) || issuedAt <= 0) return "missing_timestamp";
  if (elapsed < 0) return "clock_ahead";
  if (elapsed < MIN_FORM_AGE_MS) return "too_fast";
  if (elapsed > MAX_FORM_AGE_MS) return "expired";
  return "";
}

export const validFormTiming = (input) => formTimingFailure(input) === "";
