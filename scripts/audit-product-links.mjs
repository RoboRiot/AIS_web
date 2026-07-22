import { buildProductIdSuffix } from "../app/data/productIdSlug.mjs";

const baseUrl = String(
  process.argv.find((argument) => argument.startsWith("--base-url="))?.split("=").slice(1).join("=") ||
  "http://127.0.0.1:3000"
).replace(/\/$/, "");
const concurrency = Math.max(1, Math.min(20, Number(
  process.argv.find((argument) => argument.startsWith("--concurrency="))?.split("=")[1] || 8
)));
const headers = {
  Accept: "text/html,application/json",
  "User-Agent": "Mozilla/5.0 AIS product-link audit",
};

const getCatalog = async () => {
  const products = [];
  let cursor = "";

  do {
    const url = new URL("/api/parts/search", baseUrl);
    url.searchParams.set("sort", "asc");
    if (cursor) url.searchParams.set("cursor", cursor);

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Catalog page failed with HTTP ${response.status}: ${await response.text()}`);
    }
    const payload = await response.json();
    products.push(...(Array.isArray(payload.products) ? payload.products : []));
    cursor = payload.hasNextPage ? String(payload.nextCursor || "") : "";
    if (payload.hasNextPage && !cursor) throw new Error("Catalog pagination did not return a cursor.");
  } while (cursor);

  return products;
};

const productPaths = (product) => {
  const paths = [];
  const storedSlug = String(product.Slug || "").trim();
  if (storedSlug) paths.push({ type: "card", path: `/products/${storedSlug}` });

  const idSuffix = buildProductIdSuffix(product.id);
  if (idSuffix) paths.push({ type: "id-fallback", path: `/products/part${idSuffix}` });
  return paths;
};

const auditPath = async (item) => {
  const response = await fetch(new URL(item.path, baseUrl), {
    headers,
    redirect: "follow",
  });
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
const missingSlugs = products.filter((product) => !product.Slug);

if (duplicateIds.length || missingIds.length) {
  throw new Error(
    `Invalid catalog identity data: ${duplicateIds.length} duplicate IDs, ${missingIds.length} missing IDs.`
  );
}

const urls = products.flatMap((product) =>
  productPaths(product).map((entry) => ({ ...entry, id: product.id, name: product.Name || "" }))
);
console.log(
  `Auditing ${products.length} products (${urls.length} URLs, ${missingSlugs.length} without stored slugs) at ${baseUrl}.`
);

const failures = await runPool(urls);
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  throw new Error(`${failures.length} product URL checks failed.`);
}

console.log(`PASS: all ${urls.length} current and future-safe product URLs rendered successfully.`);
