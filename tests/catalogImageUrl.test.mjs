import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  getImageUrl,
  getPrimaryImagePath,
  resolveImageUrl,
} from "../app/data/catalogImageUrl.mjs";

const referenceImage = "/assets/images/catalog/ge-d3887t-reference.png";

test("the missing temp-204 primary image resolves to the matching OEM reference in cards and galleries", async () => {
  const product = {
    id: "temp-204",
    OEM: "GE",
    PN: "D3887t",
    PrimaryImage: "Parts/temp-204/temp-204",
    Images: [],
  };
  // Cards select the primary image; galleries use the same selector when their
  // image arrays are empty. Explicit array paths must resolve identically.
  for (const variant of [
    product,
    { ...product, PrimaryImage: "", Images: ["Parts/temp-204/temp-204.jpg"] },
    { ...product, PrimaryImage: "", ImagePaths: ["Parts/temp-204/temp-204"] },
    { id: "temp-204" },
  ]) {
    assert.equal(await resolveImageUrl(getPrimaryImagePath(variant)), referenceImage);
  }
  assert.equal(await getImageUrl(" Parts/temp-204/temp-204.jpg "), referenceImage);
  assert.equal(await resolveImageUrl("Parts/temp-204/temp-204.jpg"), referenceImage);
});

test("the repair preserves other images and accepts a future corrected product image", async () => {
  const corrected = { id: "temp-204", PrimaryImage: "Parts/temp-204/replacement.png" };
  const correctedUrl = new URL(await resolveImageUrl(getPrimaryImagePath(corrected)));
  assert.equal(correctedUrl.hostname, "firebasestorage.googleapis.com");
  assert.ok(correctedUrl.pathname.endsWith("/o/Parts%2Ftemp-204%2Freplacement.png"));
  for (const imagePath of ["Parts/temp-205/temp-205", "Parts/temp-204/temp-204-other.jpg"]) {
    assert.equal(new URL(await resolveImageUrl(imagePath)).hostname, "firebasestorage.googleapis.com");
  }
  const directUrl = "https://storage.googleapis.com/example/verified.jpg";
  assert.equal(await resolveImageUrl(directUrl), directUrl);
  assert.equal(await resolveImageUrl("/assets/images/existing.png"), "/assets/images/existing.png");
  assert.equal(await resolveImageUrl(""), null);
});

test("the bundled image matches its recorded OEM source and part identity", async () => {
  const provenance = JSON.parse(await readFile(new URL(
    "../public/assets/images/catalog/ge-d3887t-reference.source.json", import.meta.url,
  ), "utf8"));
  const image = await readFile(new URL(`../public${referenceImage}`, import.meta.url));
  assert.equal(provenance.partNumber, "D3887T");
  assert.equal(provenance.catalogProductId, "temp-204");
  const source = new URL(provenance.sourceUrl);
  assert.equal(source.hostname, "services.gehealthcare.com");
  assert.equal(source.pathname, "/medias/D3887T.png");
  assert.deepEqual(image.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  assert.equal(image.length, provenance.bytes);
  assert.equal(createHash("sha256").update(image).digest("hex"), provenance.sha256);
});
