import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getCatalogIdentifiers, getCampaignReadinessIssues, normalizePublicCatalogProduct } from "../app/data/catalogProductQuality.mjs";
import { buildLegacyProductAliases } from "../app/data/legacyProductAliases.mjs";
import { legacyProductGroups, matchesLegacyGroupMember } from "../app/data/legacyProductGroups.mjs";
import { parseProductSpecs, getProductPartNumbers, buildProductSlug, parseProductSlug } from "../app/data/seoProducts.js";

test("recovers only explicitly labeled historical identifiers without overwriting current fields", () => {
  const part = { id: "tube", Name: "CT tube", Images: ["Parts/tube.jpg"],
    Description: "Part Number: ?MCS7088,?CXB750E\nSystem Manufacturer: Toshiba\nCategory: CT" };
  assert.deepEqual(getCatalogIdentifiers(part), { PN: "MCS7088, CXB750E", OEM: "Toshiba", Modality: "CT" });
  assert.deepEqual(getCampaignReadinessIssues(part), []);
  assert.equal(normalizePublicCatalogProduct({ ...part, OEM: "Canon" }).OEM, "Canon");
  assert.ok(getCampaignReadinessIssues({ ...part, Hidden: true }).includes("not-public"));
  assert.ok(getCampaignReadinessIssues({ ...part, Images: [] }).includes("missing-image"));
  assert.equal(getCatalogIdentifiers({ Description: "A possible GE CT part 12345" }).PN, "");
});

test("historical WordPress slugs identify exact parts and preserve ambiguity protection", async () => {
  const parts = JSON.parse(await readFile(new URL("../public/assets/data/parts.json", import.meta.url), "utf8"));
  const aliases = buildLegacyProductAliases(parts);
  assert.equal(aliases.get("mx200").id, "97352cf7c8ab1");
  assert.equal(aliases.get("2241515-3-high-voltage-tank").id, "temp-21");
  assert.equal(aliases.get("aquilion-one-cxb750e-ct-tube").id, "temp-84");
  assert.equal(aliases.get("vct-signal-interface-board-5128204").id, "0f794eb65008");
  assert.equal(aliases.get("46-186852-p2-relay-k2-back-up-connection").id, "temp-42");
  const duplicate = buildLegacyProductAliases([{ id: "a", Name: "Coil", PN: "123" }, { id: "b", Name: "Coil", PN: "123" }]);
  assert.equal(duplicate.get("coil-123"), null);
});

test("verified legacy metadata is exact-ID and exact-PN scoped and preserves explicit fields", () => {
  const part = { id: "0fb5612eaccc", PN: "2378286", Name: "4 Slice PCI DIP", Images: ["Parts/board.jpg"] };
  assert.deepEqual(getCatalogIdentifiers(part), { PN: "2378286", OEM: "GE", Modality: "CT" });
  assert.deepEqual(getCampaignReadinessIssues(part), []);
  assert.equal(getCatalogIdentifiers({ ...part, id: "unrelated" }).OEM, "");
  assert.equal(getCatalogIdentifiers({ ...part, PN: "2378286-H" }).OEM, "");
  assert.equal(getCatalogIdentifiers({ ...part, OEM: "Other" }).OEM, "Other");
  assert.ok(getCampaignReadinessIssues({ ...part, WebsiteVisible: false }).includes("not-public"));
  assert.ok(getCampaignReadinessIssues({ ...part, Images: [] }).includes("missing-image"));
});

test("flattened catalog specifications do not leak into part numbers or canonical slugs", () => {
  const part = { id: "1db775068fcf", Name: "MDAS Converter Card", PN: "2258273",
    Description: "Part Number: 2258273 System Model: Lightspeed System Manufacturer: GE Category: CT Scanner Call for Pricing: (559) 537-6851" };
  assert.deepEqual(parseProductSpecs(part), { partNumber: "2258273", systemModel: "Lightspeed", manufacturer: "GE", category: "CT Scanner" });
  assert.deepEqual(getProductPartNumbers(part), ["2258273"]);
  assert.doesNotMatch(buildProductSlug(part), /system-model|manufacturer|category|559/);
  assert.equal(parseProductSlug(buildProductSlug(part)).id, part.id);
  assert.deepEqual(parseProductSpecs({ Description: "Part Number: CXB750E\nSystem Manufacturer: Toshiba\nCategory: CT" }),
    { partNumber: "CXB750E", manufacturer: "Toshiba", category: "CT" });
});

test("researched catalog repairs require matching original records and identifiers", async () => {
  const parts = JSON.parse(await readFile(new URL("../public/assets/data/parts.json", import.meta.url), "utf8"));
  const board = parts.find((part) => part.id === "b2ede27a56cb");
  assert.equal(getCatalogIdentifiers(board).PN, "BSX73-0977E");
  assert.equal(getCatalogIdentifiers(board).OEM, "Toshiba");
  assert.deepEqual(getCampaignReadinessIssues(board), []);
  assert.equal(getCatalogIdentifiers({ ...board, id: "other" }).PN, "0977");
  assert.equal(getCatalogIdentifiers({ ...board, PN: "OTHER" }).PN, "OTHER");
  assert.equal(getCatalogIdentifiers({ ...board, Description: "Different board" }).PN, "0977");
  const tube = parts.find((part) => part.id === "temp-296");
  assert.equal(getCatalogIdentifiers(tube).PN, "CXB-400C");
  assert.deepEqual(getCampaignReadinessIssues(tube), []);
  assert.equal(getCatalogIdentifiers({ ...tube, Name: "Different tube" }).PN, "");
  assert.ok(getCampaignReadinessIssues({ ...tube, Images: [] }).includes("missing-image"));
  assert.ok(getCampaignReadinessIssues({ ...board, Hidden: true }).includes("not-public"));
  assert.deepEqual(getCatalogIdentifiers(normalizePublicCatalogProduct(board)), getCatalogIdentifiers(board));
  const aliases = buildLegacyProductAliases(parts);
  assert.equal(aliases.get("bsx73-e-adc2-board").partNumber, "BSX73-0977E");
  assert.equal(aliases.get("toshiba-cxb-400c-ct-tube").partNumber, "CXB-400C");
});

test("ambiguous old product names offer guarded distinct choices, not guessed redirects", () => {
  assert.equal(legacyProductGroups["opconta-px79"].members.length, 2);
  assert.equal(legacyProductGroups["mrc-rot-gs"].members.length, 2);
  const member = legacyProductGroups["mrc-rot-gs"].members[1];
  assert.ok(matchesLegacyGroupMember(member, { id: "temp-219" }, ["9890-000-85142"]));
  assert.equal(matchesLegacyGroupMember(member, { id: "temp-219" }, ["9890-000-85103"]), false);
  assert.equal(matchesLegacyGroupMember(member, { id: "temp-218" }, ["9890-000-85142"]), false);
});

test("parts experiment preserves its budget ceiling, exact keywords and valid ad text lengths", async () => {
  const draft = JSON.parse(await readFile(new URL("../docs/parts-search-test-draft.json", import.meta.url), "utf8"));
  assert.equal(draft.proposedDailyBudgetUSD, 5);
  assert.equal(draft.totalAccountDailyBudgetCeilingUSD, 20);
  assert.equal(draft.searchPartners, false);
  assert.equal(draft.displayNetwork, false);
  assert.equal(draft.initialBidding.proposedMaxCpcUSD, 3);
  for (const group of draft.adGroups) {
    assert.ok(group.headlines.every((text) => text.length <= 30));
    assert.ok(group.descriptions.every((text) => text.length <= 90));
    assert.ok(group.keywords.every((text) => /^\[.+\]$/.test(text)));
    assert.equal(new URL(group.finalUrl).hostname, "advancedimagingparts.com");
  }
});
