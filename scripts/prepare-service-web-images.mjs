import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { getServiceImages } from "../app/data/serviceImages.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = path.join(root, "public/assets/images/services");
await mkdir(path.join(directory, "web"), { recursive: true });
sharp.concurrency(1);
sharp.cache(false);
for (const image of [...getServiceImages({ modality: "mri" }), ...getServiceImages({ modality: "ct" })]) {
  assert.match(image.src, /^\/assets\/images\/services\/web\/[A-Za-z0-9-]+\.webp$/);
  const name = path.basename(image.src);
  const result = await sharp(path.join(directory, name)).rotate()
    .resize({ width: 2560, height: 2560, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, effort: 5 }).toFile(path.join(directory, "web", name));
  console.log(JSON.stringify({ image: name, width: result.width, height: result.height, bytes: result.size }));
}
