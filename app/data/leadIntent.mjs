export function inferLeadFormType(selectedType, message) {
  if (selectedType !== "contact_form") return selectedType;
  const text = String(message || "").toLowerCase();
  if (/\b(trailer|mobile (?:mri|ct|pet|imaging)|temporary scanner|scanner rental|rental unit|trailer lease)\b/.test(text)) {
    return "trailer_request";
  }
  if (/\b(scanner down|error code|preventive maintenance|remote support|(?:mri|ct|pet|scanner|imaging).{0,30}(?:service|repair|downtime))\b/.test(text)) {
    return "service_request";
  }
  return selectedType;
}

export const requiresContactPhone = (selectedType) =>
  selectedType === "service_request" || selectedType === "trailer_request";
