export async function postLeadWithRetry(payload, { fetchImpl = fetch, refreshToken }) {
  let body = payload;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let response;
    let data;
    try {
      response = await fetchImpl("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      data = (await response.json().catch(() => ({}))) || {};
    } catch {
      const error = new Error("Unable to confirm your request. Please try again or call (559) 537-6851.");
      error.code = controller.signal.aborted ? "request_timeout" : "network_error";
      throw error;
    } finally {
      clearTimeout(timeout);
    }
    if (response.ok && data.ok) return data;
    // Only expired tokens are retried; validation and spam rejections remain final.
    if (attempt === 0 && response.status === 403 && data.code === "recaptcha_expired" && data.retryable === true) {
      const token = await refreshToken?.();
      if (token) {
        body = { ...payload, token };
        continue;
      }
    }
    const error = new Error(data.error || "Unable to confirm your request. Please try again or call (559) 537-6851.");
    error.status = response.status;
    error.code = data.code || "request_failed";
    throw error;
  }
}
