import test from "node:test";
import assert from "node:assert/strict";
import {
  getCatalogSearchScore,
  getGeneralCatalogSearchScore,
  getPartNumberCatalogSearchScore,
} from "../app/data/partCatalogSearch.mjs";

const tube = {
  id: "AIS01234",
  Name: "Dunlee X-Ray Tube Assembly",
  Description: "Replacement CT component",
  PN: "4535-6650 2751",
  OEM: "Philips",
  Modality: "CT",
};

test("finds a word anywhere in a product name", () => {
  assert.ok(getGeneralCatalogSearchScore(tube, "tube") > 0);
});

test("matches multiple name terms regardless of their order or punctuation", () => {
  assert.ok(getGeneralCatalogSearchScore(tube, "tube xray") > 0);
  assert.equal(getGeneralCatalogSearchScore(tube, "tube magnet"), 0);
});

test("general search can find PN and AIS item ID values", () => {
  assert.ok(getGeneralCatalogSearchScore(tube, "566502751") > 0);
  assert.ok(getGeneralCatalogSearchScore(tube, "AIS012") > 0);
});

test("PN search is case and punctuation insensitive and supports partial values", () => {
  assert.ok(getPartNumberCatalogSearchScore(tube, "4535 6650-2751") > 0);
  assert.ok(getPartNumberCatalogSearchScore(tube, "650275") > 0);
  assert.equal(getPartNumberCatalogSearchScore(tube, "999999"), 0);
});

test("requires both boxes to match when name and PN searches are combined", () => {
  assert.ok(getCatalogSearchScore(tube, { name: "tube", partNumber: "502751" }) > 0);
  assert.equal(getCatalogSearchScore(tube, { name: "tube", partNumber: "999999" }), 0);
});
