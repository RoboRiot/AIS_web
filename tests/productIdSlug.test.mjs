import test from "node:test";
import assert from "node:assert/strict";
import {
  buildProductIdSuffix,
  decodeProductId,
  encodeProductId,
  parseProductIdSuffix,
} from "../app/data/productIdSlug.mjs";

const ids = [
  "temp-83",
  "SC7744C1BF5AC3",
  "JpOQVGOleSDwcganC0ff",
  "347787000000",
  "future ID_üñîçødé",
];

test("round-trips current and arbitrary future Firestore document IDs losslessly", () => {
  ids.forEach((id) => {
    const encoded = encodeProductId(id);
    assert.equal(decodeProductId(encoded), id);
    assert.equal(parseProductIdSuffix(`any-readable-name${buildProductIdSuffix(id)}`), id);
  });
});

test("rejects malformed encoded product IDs", () => {
  assert.equal(decodeProductId("xyz"), null);
  assert.equal(parseProductIdSuffix("part--id-123"), null);
  assert.equal(parseProductIdSuffix("part-without-an-id"), null);
});
