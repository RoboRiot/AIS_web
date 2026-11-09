// Public Ads data-source identifier. The bearer credential stays server-side.
export const OPENAI_CONVERSIONS_PIXEL_ID = "3dF4iDnpZqFRNDoLVnDHAn";

// oppref is opaque: reject invalid input rather than rewriting its value.
export function normalizeOpenAiClickId(value) {
  return typeof value === "string" && /^[\x21-\x7e]{1,2048}$/.test(value) ? value : "";
}
