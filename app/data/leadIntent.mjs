export function inferLeadFormType(selectedType, message) {
  if (selectedType !== "contact_form") return selectedType;
  const text = String(message || "").toLowerCase();
  if (/\b(trailers?|mobile (?:mri|ct|pet|imaging)|temporary scanners?|scanner rentals?|rental units?)\b/.test(text) ||
      /\b(?:mri|ct|pet(?:\s*\/\s*ct)?)\s+(?:scanner\s+)?(?:rentals?|leases?|leasing)\b/.test(text) ||
      /\b(?:rent|lease|renting|leasing)\s+(?:(?:a|an|the)\s+)?(?:mri|ct|pet(?:\s*\/\s*ct)?)\b/.test(text)) {
    return "trailer_request";
  }
  if (/\b(scanner down|error code|preventive maintenance|remote support|(?:mri|ct|pet|scanner|imaging).{0,30}(?:service|repair|downtime))\b/.test(text)) {
    return "service_request";
  }
  return selectedType;
}

export const requiresContactPhone = (selectedType) =>
  selectedType === "service_request" || selectedType === "trailer_request";

export function classifyLeadIntent(selectedType, message = "") {
  const text = String(message).toLowerCase();
  // Business intent is independent of the form the customer chose. Parts requests
  // for a mobile scanner must not become trailer rental opportunities.
  const trailer = selectedType === "trailer_request" || (selectedType !== "part_request" &&
    /\b(?:rent(?:als?|ing|s)?|leas(?:e|es|ing))\b/.test(text) &&
    /\b(?:trailers?|mobile\s+(?:mri|ct|pet|imaging)|(?:mri|ct|pet(?:\s*\/\s*ct)?)\s+(?:scanner\s+)?(?:rental|lease|leasing))\b/.test(text));
  const businessCategory = trailer ? "trailer" : ({
    part_request: "parts", service_request: "service", contact_form: "contact",
  }[selectedType] || "contact");
  const modalities = [];
  if (/\bpet(?:\s*\/\s*ct|[ -]ct)?\b/.test(text)) modalities.push("pet_ct");
  if (/\bmri?\b/.test(text)) modalities.push("mri");
  if (/\bct\b/.test(text.replace(/\bpet(?:\s*\/\s*ct|[ -]ct)?\b/g, ""))) modalities.push("ct");
  return {
    businessCategory,
    modality: modalities.length === 1 ? modalities[0] : modalities.length ? "multiple" : "unknown",
    intentSource: trailer && selectedType !== "trailer_request" ? "message_inference" : "form_selection",
    intentReviewStatus: "unreviewed",
  };
}

export const getBusinessFormType = (record) => ({
  trailer: "trailer_request", parts: "part_request", service: "service_request", contact: "contact_form",
}[record?.businessCategory] || record?.formType || "contact_form");
