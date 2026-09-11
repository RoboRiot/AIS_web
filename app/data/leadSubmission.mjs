const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function postLeadWithRetry(payload, {
  fetchImpl = fetch, refreshToken, wait = delay, endpoint = "/api/lead",
  formType = payload.formType, leadId = payload.analytics?.leadId,
} = {}) {
  let body = payload;
  let refreshedToken = false;
  let refreshedTiming = false;
  const multipart = typeof FormData !== "undefined" && payload instanceof FormData;
  const updateBody = (fields) => {
    if (multipart) Object.entries(fields).forEach(([key, value]) => body.set(key, value));
    else body = { ...body, ...fields };
  };
  const request = async (url, options) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), multipart ? 60_000 : 30_000);
    try {
      const response = await fetchImpl(url, { ...options, signal: controller.signal });
      const data = (await response.json().catch(() => ({}))) || {};
      return { response, data };
    } catch {
      const error = new Error("Unable to confirm your request. Please try again or call (559) 537-6851.");
      error.code = controller.signal.aborted ? "request_timeout" : "network_error";
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { response, data } = await request(endpoint, {
      method: "POST",
      ...(multipart ? {} : { headers: { "Content-Type": "application/json" } }),
      body: multipart ? body : JSON.stringify(body),
    });
    if (response.ok && data.ok) return data;
    // Recover clock skew/old tabs with a server-signed timer, without changing the customer's input.
    if (!refreshedTiming && response.status === 403 && data.code === "form_timing" && data.retryable === true) {
      refreshedTiming = true;
      const session = await request("/api/lead/session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formType, leadId }),
      });
      if (session.response.ok && session.data.ok && typeof session.data.formSession === "string" &&
          Number.isFinite(session.data.waitMs) && session.data.waitMs >= 2_500 && session.data.waitMs <= 5_000) {
        await wait(session.data.waitMs);
        const token = await refreshToken?.();
        if (token) {
          updateBody({ token, formSession: session.data.formSession });
          continue;
        }
      }
    }
    // Spam/validation decisions are never retried; token expiry is retried at most once.
    if (!refreshedToken && response.status === 403 && data.code === "recaptcha_expired" && data.retryable === true) {
      refreshedToken = true;
      const token = await refreshToken?.();
      if (token) {
        updateBody({ token });
        continue;
      }
    }
    const error = new Error(data.error || "Unable to confirm your request. Please try again or call (559) 537-6851.");
    error.status = response.status;
    error.code = data.code || "request_failed";
    throw error;
  }
}
