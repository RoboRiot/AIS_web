import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ROUTES = [
  "/",
  "/about",
  "/services",
  "/trailers",
  "/parts",
  "/contact",
];
const INTERNAL_RESOURCE_PATTERN =
  /(?:https?:\/\/[^"'\\\s<>]+)?\/(?:_next\/(?:static|image)|assets\/)[^"'\\\s<>,)]*/g;
const CSS_URL_PATTERN = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

const parseArguments = () =>
  Object.fromEntries(
    process.argv.slice(2).map((argument) => {
      const [key, ...value] = argument.replace(/^--/, "").split("=");
      return [key, value.join("=") || true];
    }),
  );

const mapWithConcurrency = async (items, concurrency, worker) => {
  const results = new Array(items.length);
  let cursor = 0;

  const runners = Array.from(
    { length: Math.min(concurrency, Math.max(items.length, 1)) },
    async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await worker(items[index], index);
      }
    },
  );

  await Promise.all(runners);
  return results;
};

const fetchWithTimeout = async (url, { readBody = false, timeoutMs = 30_000 } = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": USER_AGENT,
        "cache-control": "no-cache",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    const body = readBody ? await response.text() : "";
    if (!readBody) await response.body?.cancel();
    return {
      body,
      contentType: response.headers.get("content-type") || "",
      durationMs: Date.now() - startedAt,
      release: response.headers.get("x-ais-release") || "",
      status: response.status,
      url: response.url,
    };
  } catch (error) {
    return {
      body: "",
      contentType: "",
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
      release: "",
      status: 0,
      url: String(url),
    };
  } finally {
    clearTimeout(timeout);
  }
};

const normalizeResource = (resource, pageUrl) => {
  const cleaned = resource.replaceAll("&amp;", "&");
  try {
    const url = new URL(cleaned, pageUrl);
    url.hash = "";
    return url;
  } catch {
    return null;
  }
};

const extractInternalResources = (contents, pageUrl, baseOrigin) => {
  const resources = [];
  for (const match of contents.matchAll(INTERNAL_RESOURCE_PATTERN)) {
    const resource = normalizeResource(match[0], pageUrl);
    if (resource?.origin === baseOrigin) resources.push(resource.href);
  }
  return resources;
};

const loadRoutes = async (baseUrl) => {
  const sitemapUrl = new URL("/sitemap.xml", baseUrl);
  const sitemap = await fetchWithTimeout(sitemapUrl, { readBody: true });
  if (sitemap.status !== 200) return DEFAULT_ROUTES;

  const routes = [];
  for (const match of sitemap.body.matchAll(/<loc>(.*?)<\/loc>/g)) {
    try {
      const sourceUrl = new URL(match[1]);
      routes.push(`${sourceUrl.pathname}${sourceUrl.search}`);
    } catch {
      // Ignore malformed sitemap entries; the site audit reports valid routes.
    }
  }
  return routes.length > 0 ? [...new Set(routes)] : DEFAULT_ROUTES;
};

export const verifySiteAssets = async ({
  baseUrl,
  concurrency = 8,
  maxPages = Number.POSITIVE_INFINITY,
  maxProductPages = 40,
  scanAllPages = false,
}) => {
  const base = new URL(baseUrl);
  const discoveredRoutes = await loadRoutes(base);
  const productRoutes = discoveredRoutes.filter((route) => route.startsWith("/products/"));
  const regularRoutes = discoveredRoutes.filter((route) => !route.startsWith("/products/"));
  const routes = (
    scanAllPages
      ? discoveredRoutes
      : [...regularRoutes, ...productRoutes.slice(0, maxProductPages)]
  ).slice(0, maxPages);
  const pageResults = await mapWithConcurrency(routes, concurrency, async (route) => {
    const pageUrl = new URL(route, base);
    const response = await fetchWithTimeout(pageUrl, { readBody: true, timeoutMs: 45_000 });
    return {
      ...response,
      requestedUrl: pageUrl.href,
      resources:
        response.status === 200
          ? extractInternalResources(response.body, response.url, base.origin)
          : [],
    };
  });

  const resourceToPages = new Map();
  for (const page of pageResults) {
    for (const resource of page.resources) {
      if (!resourceToPages.has(resource)) resourceToPages.set(resource, new Set());
      resourceToPages.get(resource).add(page.requestedUrl);
    }
  }

  const initialResourceUrls = [...resourceToPages.keys()];
  const initialResults = await mapWithConcurrency(
    initialResourceUrls,
    concurrency * 2,
    async (resourceUrl) => {
      const isCss = new URL(resourceUrl).pathname.endsWith(".css");
      return {
        resourceUrl,
        referencedBy: [...(resourceToPages.get(resourceUrl) || [])],
        ...(await fetchWithTimeout(resourceUrl, { readBody: isCss })),
      };
    },
  );

  for (const result of initialResults) {
    if (result.status !== 200 || !result.contentType.includes("text/css")) continue;
    for (const match of result.body.matchAll(CSS_URL_PATTERN)) {
      const nested = normalizeResource(match[2], result.resourceUrl);
      if (
        nested?.origin === base.origin &&
        !nested.protocol.startsWith("data") &&
        !resourceToPages.has(nested.href)
      ) {
        resourceToPages.set(nested.href, new Set([result.resourceUrl]));
      }
    }
  }

  const initialSet = new Set(initialResourceUrls);
  const nestedResourceUrls = [...resourceToPages.keys()].filter((url) => !initialSet.has(url));
  const nestedResults = await mapWithConcurrency(
    nestedResourceUrls,
    concurrency * 2,
    async (resourceUrl) => ({
      resourceUrl,
      referencedBy: [...(resourceToPages.get(resourceUrl) || [])],
      ...(await fetchWithTimeout(resourceUrl)),
    }),
  );
  const resourceResults = [...initialResults, ...nestedResults];

  const pageFailures = pageResults.filter(
    (page) => page.status !== 200 || !page.contentType.includes("text/html"),
  );
  const assetFailures = resourceResults.filter((resource) => {
    if (resource.status !== 200) return true;
    const pathname = new URL(resource.resourceUrl).pathname;
    if (pathname.endsWith(".css")) return !resource.contentType.includes("text/css");
    if (pathname.endsWith(".js")) return !resource.contentType.includes("javascript");
    return resource.contentType.includes("text/html");
  });
  const releases = [...new Set(pageResults.map((page) => page.release).filter(Boolean))];
  const slowestPages = [...pageResults]
    .sort((left, right) => right.durationMs - left.durationMs)
    .slice(0, 12)
    .map((page) => ({
      durationMs: page.durationMs,
      route: new URL(page.requestedUrl).pathname,
      status: page.status,
    }));

  return {
    assetFailures,
    pageFailures,
    pageResults,
    releases,
    resourceResults,
    routes,
    discoveredRoutes,
    slowestPages,
  };
};

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const args = parseArguments();
  const baseUrl = String(args["base-url"] || "http://127.0.0.1:3000");
  const concurrency = Math.max(1, Math.min(Number(args.concurrency) || 8, 20));
  const maxPages = args["max-pages"]
    ? Math.max(1, Number(args["max-pages"]) || 1)
    : Number.POSITIVE_INFINITY;
  const maxProductPages = Math.max(
    0,
    Number(args["max-product-pages"] ?? 40) || 0,
  );
  const scanAllPages = args["all-pages"] === true || args["all-pages"] === "true";

  try {
    const result = await verifySiteAssets({
      baseUrl,
      concurrency,
      maxPages,
      maxProductPages,
      scanAllPages,
    });
    console.log(
      `Verified ${result.pageResults.length} pages and ${result.resourceResults.length} ` +
        `same-origin resources from ${result.discoveredRoutes.length} sitemap routes ` +
        `across release(s): ${result.releases.join(", ") || "unlabeled"}.`,
    );
    console.log("Slowest pages:");
    for (const page of result.slowestPages) {
      console.log(`- ${page.durationMs}ms ${page.status} ${page.route}`);
    }

    if (result.pageFailures.length > 0) {
      console.error(`Page failures (${result.pageFailures.length}):`);
      for (const page of result.pageFailures.slice(0, 40)) {
        console.error(`- ${page.status || "ERR"} ${page.requestedUrl} ${page.error || ""}`);
      }
    }

    if (result.assetFailures.length > 0) {
      console.error(`Asset failures (${result.assetFailures.length}):`);
      for (const asset of result.assetFailures.slice(0, 80)) {
        console.error(
          `- ${asset.status || "ERR"} ${asset.resourceUrl} ` +
            `${asset.error || asset.contentType} (from ${asset.referencedBy[0] || "unknown"})`,
        );
      }
    }

    if (result.pageFailures.length > 0 || result.assetFailures.length > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.stack || error.message : error);
    process.exitCode = 1;
  }
}
