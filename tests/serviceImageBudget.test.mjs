import assert from "node:assert/strict";
import test from "node:test";
import { verifyServiceWebImages } from "../scripts/verify-service-web-images.mjs";

test("every service image stays within the production decoding and transfer budgets", async () => {
  assert.deepEqual(await verifyServiceWebImages(), { images: 7, maxDimension: 2560, maxPixels: 4500000 });
});
