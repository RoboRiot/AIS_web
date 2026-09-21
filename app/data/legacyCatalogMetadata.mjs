// Exact historical records verified against the checked-in CT OEM catalogs.
// Fill missing identifiers only; never change visibility, inventory, or images.
const verifiedRecords = {
  "0fb5612eaccc": ["2378286", "GE", "CT"],
  "1ba963141b0b": ["2326523", "GE", "CT"],
  "temp-62": ["5120815", "GE", "CT"],
  "3c00dfa56d1e": ["2266521-4", "GE", "CT"],
  "e7efa173f606": ["5116570", "GE", "CT"],
  "f1002a70b12d": ["2137958-3", "GE", "CT"],
  "a761c231a605": ["5136400-3", "GE", "CT"],
  "7aa4615a6b0f": ["2318808-3", "GE", "CT"],
  "782a42ec330f": ["2256729", "GE", "CT"],
};

export const getVerifiedLegacyMetadata = (product = {}) => {
  // Research and source links are recorded in docs/product-url-research-2026-09-16.md.
  const id = String(product.id);
  const pn = String(product.PN || "").trim().toUpperCase();
  // Exact record + name guards; evidence is in docs/lead-measurement-repairs-2026-09-21.md.
  if (id === "temp-41" && (!pn || pn === "46-170021P10") &&
      /^46-170021p10\s+fuse$/i.test(String(product.Name || "").trim())) {
    return { PN: "46-170021P10", OEM: "GE", Modality: "CT" };
  }
  if (id === "a60097f343dc" && (!pn || pn === "BSX73-0893E") &&
      /^BSX73-0893E\s+Converter-16$/i.test(String(product.Name || "").trim())) {
    return { PN: "BSX73-0893E", OEM: "Toshiba", Modality: "CT" };
  }
  if (id === "b2ede27a56cb" && ["0977", "BSX73-0977E"].includes(pn) &&
      /BSX73-0977\*?E\s+ADC2/i.test(product.Description || "")) {
    return { PN: "BSX73-0977E", OEM: "Toshiba", Modality: "CT" };
  }
  if (id === "temp-296" && (!pn || pn === "CXB-400C") &&
      /Toshiba\s+CXB\s*[-\u2013\u2014]\s*400C\s+CT\s+Tube/i.test(product.Name || "")) {
    return { PN: "CXB-400C", OEM: "Toshiba", Modality: "CT" };
  }
  const match = verifiedRecords[String(product.id)];
  if (!match || String(product.PN || "").trim().toUpperCase() !== match[0]) return {};
  return { OEM: match[1], Modality: match[2] };
};
