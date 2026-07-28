import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCatalogSearchFields,
  getCatalogPartNumberLookupTerm,
  getCatalogSearchLookupTerm,
} from "../app/data/partCatalogIndex.mjs";

const product = {
  id: "SC123456789ABC",
  Name: "Physiological Acquisition Controller",
  PN: "5112668-2",
  AlternatePartNumbers: ["5112668-02"],
  OEM: "GE",
  Modality: "MRI",
  Modalities: ["MRI"],
  Machine: "Signa HDxt",
};

test("builds name, model, and part-number prefixes for indexed lookup", () => {
  const fields = buildCatalogSearchFields(product, product.id);

  assert.ok(fields.SearchTerms.includes("phys"));
  assert.ok(fields.SearchTerms.includes("acquisition"));
  assert.ok(fields.SearchTerms.includes("hdxt"));
  assert.ok(fields.PNPrefixes.includes("5112668"));
  assert.ok(fields.PNPrefixes.includes("SC1234"));
});

test("uses the longest useful word as the general-search lookup term", () => {
  assert.equal(getCatalogSearchLookupTerm("GE acquisition controller"), "acquisition");
  assert.equal(getCatalogSearchLookupTerm("x"), "");
});

test("normalizes the part-number lookup term", () => {
  assert.equal(getCatalogPartNumberLookupTerm("511-2668 2"), "51126682");
});
