import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanCatalogDescription,
  cleanCatalogProductName,
  getCampaignReadinessIssues,
  isCampaignReadyProduct,
} from "../app/data/catalogProductQuality.mjs";

const readyProduct = {
  id: "SC123456789ABC",
  Name: "Gradient Power Supply",
  PN: "5112668-2",
  OEM: "GE",
  Modality: "MRI",
  PrimaryImage: "https://example.com/part.jpg",
};

test("removes a parsed part-number suffix from the beginning of a name", () => {
  assert.equal(
    cleanCatalogProductName({ ...readyProduct, Name: "-2 Gradient Power Supply" }),
    "Gradient Power Supply"
  );
});

test("preserves meaningful leading numbers that are not PN suffix artifacts", () => {
  assert.equal(
    cleanCatalogProductName({
      ...readyProduct,
      Name: "18 GB Scan Data Disk Board",
    }),
    "18 GB Scan Data Disk Board"
  );
});

test("cleans malformed imported description separators", () => {
  assert.equal(
    cleanCatalogDescription("Description:??Description:??Gradient power supply"),
    "Description: Gradient power supply"
  );
});

test("accepts a complete, visible product with an image", () => {
  assert.equal(isCampaignReadyProduct(readyProduct), true);
  assert.deepEqual(getCampaignReadinessIssues(readyProduct), []);
});

test("rejects hidden, incomplete, or image-less records", () => {
  const issues = getCampaignReadinessIssues({
    ...readyProduct,
    Hidden: true,
    PrimaryImage: "",
  });
  assert.ok(issues.includes("not-public"));
  assert.ok(issues.includes("missing-image"));
});
