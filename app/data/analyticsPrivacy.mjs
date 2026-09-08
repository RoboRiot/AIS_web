export const redactAnalyticsText = (value, maxLength = 140) =>
  String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[redacted-email]")
    .replace(/(?<![a-zA-Z0-9])(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}(?![a-zA-Z0-9])/g, "[redacted-phone]")
    .replace(/\s+/g, " ").trim().slice(0, maxLength);

export function analyticsPageUrl(value) {
  const url = new URL(value);
  const attributionKeys = new Set(["gclid", "gbraid", "wbraid", "msclkid", "utm_source", "utm_medium", "utm_campaign", "utm_id"]);
  for (const key of [...url.searchParams.keys()]) {
    if (!attributionKeys.has(key)) url.searchParams.delete(key);
  }
  url.hash = "";
  return url.href;
}
