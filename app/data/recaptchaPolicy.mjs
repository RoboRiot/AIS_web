export function assessRecaptcha(result, { expectedAction, minimumScore = 0.5, allowedHosts = [] }) {
  const fail = (code, retryable = false) => ({ ok: false, code, retryable });
  if (!result?.success) {
    return result?.["error-codes"]?.includes("timeout-or-duplicate")
      ? fail("recaptcha_expired", true) : fail("recaptcha_rejected");
  }
  if (result.action !== expectedAction) return fail("recaptcha_action");
  if (!allowedHosts.includes(String(result.hostname || "").toLowerCase())) return fail("recaptcha_hostname");
  const threshold = Number.isFinite(minimumScore) && minimumScore >= 0 && minimumScore <= 1
    ? minimumScore : 0.5;
  if (typeof result.score !== "number" || !Number.isFinite(result.score) || result.score < threshold) {
    return fail("recaptcha_score");
  }
  return { ok: true, code: "verified", retryable: false };
}
