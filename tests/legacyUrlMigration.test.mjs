import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";
import createNextConfig from "../next.config.mjs";
import { buildLegacyProductAliases, matchesLegacyProduct } from "../app/data/legacyProductAliases.mjs";
import { verifiedLegacyProductRoutes } from "../app/data/verifiedLegacyProductRoutes.mjs";
import { getCatalogIdentifiers, getCampaignReadinessIssues, normalizePublicCatalogProduct } from "../app/data/catalogProductQuality.mjs";

const catalog = JSON.parse(await readFile(new URL("../public/assets/data/parts.json", import.meta.url), "utf8"));

test("all reviewed historical redirects retain exact ID, revision and manufacturer guards", () => {
  const aliases = buildLegacyProductAliases(catalog);
  for (const route of verifiedLegacyProductRoutes) {
    const reference = aliases.get(route.slug);
    assert.equal(reference.id, route.id);
    assert.equal(reference.partNumber, route.partNumber);
    assert.equal(reference.oem, route.oem);
    const product = { id: route.id, PN: route.partNumber, OEM: route.oem };
    assert.ok(matchesLegacyProduct(reference, product));
    assert.equal(matchesLegacyProduct(reference, { ...product, PN: `${route.partNumber}-R` }), false);
    assert.equal(matchesLegacyProduct(reference, { ...product, id: "other" }), false);
    assert.equal(matchesLegacyProduct(reference, { ...product, OEM: "other" }), false);
    assert.equal(matchesLegacyProduct(reference, null), false);
  }
  assert.equal(aliases.has("power-brush-2189175"), false);
  assert.equal(aliases.has("invented-product-5145567-2"), false);
});

test("preserved labeled description headings resolve names damaged during import", () => {
  const aliases = buildLegacyProductAliases(catalog, []);
  for (const [slug, id] of [
    ["proportioal-valve-assy-positoning-gt-5127284-4", "39abd5a86486"],
    ["encoder-cradle-danaher-2342727-3", "642eb1a8d389"],
    ["h-power-ac-elevation-motor-emc2-2342733-2", "dbba0432b7f6"],
    ["hv-tank-hemit-jedi-2237336-2", "9656307e6cff"],
    ["gcifm-pwb-px77-99455", "cb3563dde7c4"],
  ]) assert.equal(aliases.get(slug)?.id, id, slug);
});

test("ambiguous historical headings cannot be overridden by a reviewed route", () => {
  const products = ["a", "b"].map((id) => ({ id, PN: "123", Name: `Different ${id}`,
    Description: "Original Board\n\nPart Number: 123" }));
  const aliases = buildLegacyProductAliases(products, [{ slug: "original-board-123", id: "a", partNumber: "123", oem: "GE" }]);
  assert.equal(aliases.get("original-board-123"), null);
});

test("motor metadata repair is restricted to the verified original record", () => {
  const motor = catalog.find((part) => part.id === "9f27cda675d8");
  assert.deepEqual(getCatalogIdentifiers(motor), { PN: "46-282360P1", OEM: "GE", Modality: "MRI" });
  assert.deepEqual(getCampaignReadinessIssues(motor), []);
  assert.equal(normalizePublicCatalogProduct(motor).Modality, "MRI");
  assert.doesNotMatch(normalizePublicCatalogProduct(motor).Description, /in stock|90 days warranty/i);
  assert.match(motor.Description, /In stock/);
  assert.deepEqual(normalizePublicCatalogProduct(normalizePublicCatalogProduct(motor)), normalizePublicCatalogProduct(motor));
  for (const changes of [{ id: "other" }, { Name: "Other Motor" }, { Description: "Other Motor" }, { PN: "46-282360P1-H" }, { OEM: "Other" }]) {
    assert.notEqual(getCatalogIdentifiers({ ...motor, ...changes }).Modality, "MRI");
  }
  assert.ok(getCampaignReadinessIssues({ ...motor, Hidden: true }).includes("not-public"));
  assert.ok(getCampaignReadinessIssues({ ...motor, Images: [], PrimaryImage: "", ImagePaths: [] }).includes("missing-image"));
});

test("only numeric historical archive pages redirect to the replacement parts catalog", async () => {
  const redirects = await createNextConfig(PHASE_DEVELOPMENT_SERVER).redirects();
  const rule = redirects.find((item) => item.source.startsWith("/parts/page/"));
  assert.equal(rule.source, "/parts/page/:page([1-9]\\d*)");
  assert.equal(rule.destination, "/parts");
  assert.equal(rule.permanent, true);
  assert.ok(!redirects.some((item) => item.source === "/products/:slug"));
});
