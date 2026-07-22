import test from "node:test";
import assert from "node:assert/strict";
import { toPlainFirestoreData } from "../app/data/plainFirestoreData.mjs";

class FakeTimestamp {
  toDate() {
    return new Date("2026-07-22T19:15:00.000Z");
  }
}

class FakeDocumentReference {
  constructor(path) {
    this.path = path;
  }
}

test("converts nested Firestore class values into client-safe plain data", () => {
  const source = {
    id: "SC7744C1BF5AC3",
    UpdatedAt: new FakeTimestamp(),
    reference: new FakeDocumentReference("Parts/SC7744C1BF5AC3"),
    location: { latitude: 33.6, longitude: -117.7 },
    nested: [{ count: 1n }],
  };

  const result = toPlainFirestoreData(source);

  assert.deepEqual(result, {
    id: "SC7744C1BF5AC3",
    UpdatedAt: "2026-07-22T19:15:00.000Z",
    reference: "Parts/SC7744C1BF5AC3",
    location: { latitude: 33.6, longitude: -117.7 },
    nested: [{ count: "1" }],
  });
  assert.equal(Object.getPrototypeOf(result), Object.prototype);
  assert.equal(Object.getPrototypeOf(result.nested[0]), Object.prototype);
});
