const normalizeText = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const componentRules = [
  { group: "coil", pattern: /\b(?:mri |rf |surface |head |body |spine |knee |breast )?coil\b/, score: 190 },
  { group: "tube", pattern: /\b(?:ct |x ray )?tube\b/, score: 185 },
  { group: "detector", pattern: /\bdetector\b|\bdetector module\b/, score: 180 },
  { group: "magnet", pattern: /\bmagnet\b|\bshim\b/, score: 175 },
  { group: "gradient", pattern: /\bgradient\b|\bgradient amplifier\b/, score: 170 },
  { group: "amplifier", pattern: /\b(?:rf |gradient |power )?amplifier\b/, score: 165 },
  { group: "das", pattern: /\bdata acquisition\b|\bdas\b/, score: 160 },
  { group: "gantry", pattern: /\bgantry\b|\bslip ring\b/, score: 155 },
  { group: "collimator", pattern: /\bcollimator\b/, score: 150 },
  { group: "table", pattern: /\bpatient table\b|\bcradle\b|\btable drive\b/, score: 145 },
  { group: "cooling", pattern: /\bchiller\b|\bheat exchanger\b|\bcompressor\b|\bcooling\b/, score: 140 },
  { group: "power", pattern: /\bpower supply\b|\bpower distribution\b|\bpdu\b|\bpsu\b/, score: 135 },
  { group: "controller", pattern: /\bcontroller\b|\bcontrol module\b/, score: 130 },
  { group: "console", pattern: /\bconsole\b|\bworkstation\b|\bcomputer\b|\breconstruction\b/, score: 125 },
  { group: "monitor", pattern: /\bmonitor\b|\bdisplay\b/, score: 115 },
  { group: "board", pattern: /\bboard\b|\bpwb\b|\bpcb\b|\bbackplane\b/, score: 105 },
  { group: "camera", pattern: /\bcamera\b|\bphotomultiplier\b|\bpm tube\b/, score: 100 },
];

const lowValuePattern =
  /\btape\b|\bfeeler gauge\b|\bscrew\b|\bwasher\b|\bnut\b|\bbolt\b|\bbrass\b|\bfuse\b|\bspring\b|\bpin\b|\bo ring\b|\blabel\b|\badhesive\b|\broll\b/;

export const relevantCatalogSearchTerms = [
  "coil",
  "tube",
  "detector",
  "magnet",
  "gradient",
  "amplifier",
  "gantry",
  "collimator",
  "chiller",
  "power",
  "controller",
  "workstation",
  "board",
  "cradle",
];

export const getCatalogComponentGroup = (product = {}) => {
  const text = normalizeText(`${product.Name || ""} ${product.Description || ""}`);
  return componentRules.find((rule) => rule.pattern.test(text))?.group || "other";
};

export const getCatalogMerchandisingScore = (product = {}, interestScore = 0) => {
  const text = normalizeText(`${product.Name || ""} ${product.Description || ""}`);
  const matchingRules = componentRules.filter((rule) => rule.pattern.test(text));
  const componentScore = matchingRules.reduce(
    (total, rule, index) => total + (index === 0 ? rule.score : Math.round(rule.score * 0.2)),
    0
  );

  if (!componentScore) return 0;

  const metadataScore =
    (product.OEM ? 8 : 0) +
    (product.Modality ? 8 : 0) +
    (product.Machine ? 14 : 0);
  const lowValuePenalty = lowValuePattern.test(text) ? 220 : 0;
  const popularityScore = Math.min(320, Math.round(Math.log1p(Math.max(0, interestScore)) * 92));

  return Math.max(0, componentScore + metadataScore + popularityScore - lowValuePenalty);
};

export const rankRelevantCatalogProducts = (
  products = [],
  interestScores = new Map(),
  limit = 36
) => {
  const ranked = products
    .map((product) => ({
      product,
      component: getCatalogComponentGroup(product),
      score: getCatalogMerchandisingScore(
        product,
        Number(interestScores.get(String(product.id)) || 0)
      ),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score;
      return String(left.product.Name || "").localeCompare(String(right.product.Name || ""));
    });

  const selected = [];
  const componentCounts = new Map();
  const systemCounts = new Map();

  for (const entry of ranked) {
    const systemKey = `${entry.product.OEM || "Other"}:${entry.product.Modality || "Other"}`;
    const componentCount = componentCounts.get(entry.component) || 0;
    const systemCount = systemCounts.get(systemKey) || 0;
    if (componentCount >= 3 || systemCount >= 4) continue;

    selected.push(entry.product);
    componentCounts.set(entry.component, componentCount + 1);
    systemCounts.set(systemKey, systemCount + 1);
    if (selected.length >= limit) break;
  }

  return selected;
};
