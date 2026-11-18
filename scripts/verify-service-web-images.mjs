import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { getServiceImages } from "../app/data/serviceImages.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export async function verifyServiceWebImages() {
  const images = [...getServiceImages({ modality: "mri" }), ...getServiceImages({ modality: "ct" })];
  for (const image of images) {
    assert.match(image.src, /^\/assets\/images\/services\/web\/[A-Za-z0-9-]+\.webp$/, "Use bounded web derivatives, not full-resolution originals");
    const file = path.join(root, "public", image.src);
    const metadata = await sharp(file).metadata();
    assert.equal(metadata.format, "webp", image.src);
    assert(metadata.width <= 2560 && metadata.height <= 2560, `${image.src}: image dimensions exceed the decoding budget`);
    assert(metadata.width * metadata.height <= 4500000, `${image.src}: decoded pixel budget exceeded`);
    assert((await stat(file)).size <= 750000, `${image.src}: file-size budget exceeded`);
  }
  return { images: images.length, maxDimension: 2560, maxPixels: 4500000 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await verifyServiceWebImages()));
}
