import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import createNextConfig from "../next.config.mjs";

test("regional GA collection is allowed without allowing arbitrary third-party connections", async () => {
  const config = createNextConfig("phase-development-server");
  const headers = await config.headers();
  const csp = headers.find((row) => row.source === "/(.*)").headers.find((row) => row.key === "Content-Security-Policy").value;
  const connect = csp.split(";").find((directive) => directive.trim().startsWith("connect-src"));
  assert.match(connect, /https:\/\/\*\.google-analytics\.com/);
  assert.doesNotMatch(connect, /(?:^|\s)\*(?:\s|$)|(?:^|\s)https:(?:\s|$)/);
  assert.match(csp, /object-src 'none'/);
});

test("quote-only catalog describes an indexable page without fabricated Product eligibility", async () => {
  const product = await readFile(new URL("../app/products/[slug]/page.js", import.meta.url), "utf8");
  assert.match(product, /"@type": "WebPage"/);
  assert.match(product, /"@type": "BreadcrumbList"/);
  assert.doesNotMatch(product, /"@type": "Product"|priceCurrency:|aggregateRating:|offers:/);
  assert.match(product, /canonical: url/);
  assert.match(product, /JSON\.stringify\(jsonLd\)\.replace/);
  const category = await readFile(new URL("../app/parts/[oem]/[modality]/page.js", import.meta.url), "utf8");
  assert.match(category, /JSON\.stringify\(itemList\)\.replace/);
});

test("tag status is internal-only and is not another Google conversion", async () => {
  const integration = await readFile(new URL("../components/analytics/GoogleAnalytics.js", import.meta.url), "utf8");
  assert.match(integration, /"google_tag_status", status, \{ sendToGoogle: false \}/);
  const dispatch = await readFile(new URL("../components/utils/analytics.js", import.meta.url), "utf8");
  assert.match(dispatch, /options\.sendToGoogle !== false/);
});
