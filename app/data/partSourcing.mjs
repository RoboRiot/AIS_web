export function buildPartSourcingHref({ query = "", partNumber = "", oem = "", modality = "", model = "" } = {}) {
  const search = String(partNumber || query).trim().slice(0, 120);
  const identifier = partNumber || (/\d/.test(search) ? search : "");
  const params = new URLSearchParams({ inquiry: identifier ? "parts" : "general", source: "parts_no_results" });
  if (identifier) params.set("pn", String(identifier).slice(0, 120));
  const context = [oem, modality, model].filter(Boolean).join(" / ");
  params.set("message", [search ? `Please help source: ${search}.` : "I need help sourcing an imaging part.", context].filter(Boolean).join("\n"));
  return `/contact?${params.toString()}`;
}
