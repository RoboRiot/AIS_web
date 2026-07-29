import assert from "node:assert/strict";
import test from "node:test";
import {
  getCatalogMerchandisingScore,
  rankRelevantCatalogProducts,
} from "../app/data/catalogRelevance.mjs";

const product = (id, name, overrides = {}) => ({
  id,
  Name: name,
  PN: `PN-${id}`,
  OEM: "GE",
  Modality: "MRI",
  ...overrides,
});

test("keeps incidental shop supplies out of the relevant default catalog", () => {
  assert.equal(
    getCatalogMerchandisingScore(product("tape", "0.002 Thick Tape Roll"), 50),
    0
  );
});

test("recognizes major medical-imaging components", () => {
  assert.ok(getCatalogMerchandisingScore(product("coil", "8 Channel MRI Head Coil")) > 150);
  assert.ok(getCatalogMerchandisingScore(product("tube", "CT X-Ray Tube Assembly")) > 150);
  assert.ok(getCatalogMerchandisingScore(product("detector", "CT Detector Module")) > 150);
});

test("uses interest without allowing one component or system to take over", () => {
  const products = [
    product("coil-1", "MRI Head Coil"),
    product("coil-2", "MRI Body Coil"),
    product("coil-3", "MRI Knee Coil"),
    product("coil-4", "MRI Spine Coil"),
    product("tube-1", "CT Tube", { Modality: "CT" }),
    product("detector-1", "CT Detector", { OEM: "Siemens", Modality: "CT" }),
  ];
  const interest = new Map([
    ["coil-1", 20],
    ["coil-2", 18],
    ["coil-3", 16],
    ["coil-4", 14],
  ]);

  const ranked = rankRelevantCatalogProducts(products, interest, 6);
  assert.equal(ranked.filter((entry) => entry.Name.includes("Coil")).length, 3);
  assert.ok(ranked.some((entry) => entry.Name === "CT Tube"));
  assert.ok(ranked.some((entry) => entry.Name === "CT Detector"));
});
