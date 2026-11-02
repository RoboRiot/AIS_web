import {
  buildProductIdSuffix,
  parseProductIdSuffix,
} from "../app/data/productIdSlug.mjs";
import { readSitemapTree } from "./verify-sitemaps.mjs";

const baseUrl = String(
  process.argv.find((argument) => argument.startsWith("--base-url="))?.split("=").slice(1).join("=") ||
  "http://127.0.0.1:3000"
).replace(/\/$/, "");
const concurrency = Math.max(1, Math.min(2, Number(
  process.argv.find((argument) => argument.startsWith("--concurrency="))?.split("=")[1] || 2
)));
const headers = {
  Accept: "text/html,application/json",
  "User-Agent": "Mozilla/5.0 AIS product-link audit",
};

const getCatalog = async () => {
  const { urls } = await readSitemapTree(async (pathname) => {
    const response = await fetch(new URL(pathname, baseUrl), { headers, signal: AbortSignal.timeout(45000) });
    if (!response.ok) throw new Error(`Sitemap ${pathname} failed with HTTP ${response.status}`);
    return response.text();
  });
  return urls.filter((url) => new URL(url).pathname.startsWith("/products/")).map((url) => {
    const path = new URL(url).pathname;
    const id = parseProductIdSuffix(path.split("/").pop());
    return { id, Slug: path.split("/").pop(), Name: path };
  });
};

const productPaths = (product) => {
  const paths = [];
  const storedSlug = String(product.Slug || "").trim();
  if (storedSlug) paths.push({ type: "card", path: `/products/${storedSlug}` });

  const idSuffix = buildProductIdSuffix(product.id);
  if (idSuffix) paths.push({ type: "id-fallback", path: `/products/part${idSuffix}` });
  return paths;
};

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const fetchAuditPage = async (path) => {
  const maxAttempts = 3;
  let lastResponse;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    lastResponse = await fetch(new URL(path, baseUrl), {
      headers,
      redirect: "follow",
    });

    if (lastResponse.ok || attempt === maxAttempts) return lastResponse;

    const retryable =
      lastResponse.status === 404 ||
      lastResponse.status === 429 ||
      lastResponse.status >= 500;
    if (!retryable) return lastResponse;

    await lastResponse.arrayBuffer();
    await sleep(250 * attempt);
  }

  return lastResponse;
};

const auditPath = async (item) => {
  const response = await fetchAuditPage(item.path);
  const body = await response.text();
  const escapedId = String(item.id)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const renderedExpectedProduct = body.includes(`data-product-id="${escapedId}"`);
  if (!response.ok || !renderedExpectedProduct) {
    return {
      ...item,
      status: response.status,
      finalUrl: response.url,
      error: response.ok ? "Did not render the expected product ID" : `HTTP ${response.status}`,
    };
  }
  return null;
};

const runPool = async (items) => {
  const failures = [];
  let nextIndex = 0;
  let completed = 0;

  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const failure = await auditPath(items[index]);
      if (failure) failures.push(failure);
      completed += 1;
      if (completed % 100 === 0 || completed === items.length) {
        console.log(`Checked ${completed}/${items.length} product URLs.`);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return failures;
};

const products = await getCatalog();
const duplicateIds = products
  .map((product) => String(product.id || ""))
  .filter((id, index, ids) => id && ids.indexOf(id) !== index);
const missingIds = products.filter((product) => !product.id);
const duplicatePaths = products
  .map((product) => product.Slug)
  .filter((path, index, paths) => path && paths.indexOf(path) !== index);

if (duplicateIds.length || duplicatePaths.length || missingIds.length) {
  throw new Error(
    `Invalid product sitemap: ${duplicateIds.length} duplicate IDs, ` +
      `${duplicatePaths.length} duplicate paths, ${missingIds.length} missing IDs.`
  );
}

const urls = products.flatMap((product) =>
  productPaths(product).map((entry) => ({ ...entry, id: product.id, name: product.Name || "" }))
);
console.log(
  `Auditing ${products.length} products (${urls.length} canonical and fallback URLs) at ${baseUrl}.`
);

const failures = await runPool(urls);
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  throw new Error(`${failures.length} product URL checks failed.`);
}

console.log(`PASS: all ${urls.length} current and future-safe product URLs rendered successfully.`);
