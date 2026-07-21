import { NextResponse } from "next/server";

const DEFAULT_STAGING_HOST = "advancedimaging.duckdns.org";
const STAGING_ROBOTS_POLICY = ["User-agent: *", "Disallow: /", ""].join("\n");

const KNOWN_GOOD_BOTS = [
  "googlebot",
  "bingbot",
  "yandexbot",
  "duckduckbot",
  "baiduspider",
  "applebot",
  "google-inspectiontool",
  "chrome-lighthouse",
  "lighthouse",
  "slurp",
  "facebookexternalhit",
  "linkedinbot",
  "twitterbot",
];

const LIKELY_AUTOMATION_UA = [
  "python-requests",
  "curl",
  "wget",
  "scrapy",
  "httpclient",
  "node-fetch",
  "axios",
  "java/",
  "go-http-client",
  "libwww",
  "selenium",
  "playwright",
  "phantomjs",
  "headlesschrome",
];

function getRequestHost(request) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host") || request.nextUrl.host || "";

  return host.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
}

function getStagingHosts() {
  const configuredHosts =
    process.env.STAGING_HOSTS || process.env.STAGING_HOST || DEFAULT_STAGING_HOST;

  return configuredHosts
    .split(",")
    .map((host) => host.trim().toLowerCase().replace(/:\d+$/, ""))
    .filter(Boolean);
}

function isStagingRequest(request) {
  return getStagingHosts().includes(getRequestHost(request));
}

function addStagingHeaders(response) {
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  return response;
}

function decodeBasicCredentials(authorization) {
  if (!authorization?.startsWith("Basic ")) {
    return null;
  }

  try {
    const encoded = authorization.slice(6).trim();
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    const separator = decoded.indexOf(":");

    if (separator < 0) {
      return null;
    }

    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

function constantTimeEqual(left, right) {
  const leftValue = String(left);
  const rightValue = String(right);
  const length = Math.max(leftValue.length, rightValue.length);
  let difference = leftValue.length ^ rightValue.length;

  for (let index = 0; index < length; index += 1) {
    difference |=
      (leftValue.charCodeAt(index) || 0) ^ (rightValue.charCodeAt(index) || 0);
  }

  return difference === 0;
}

function stagingAuthResponse(request) {
  const expectedUsername = process.env.STAGING_BASIC_AUTH_USER;
  const expectedPassword = process.env.STAGING_BASIC_AUTH_PASSWORD;

  if (!expectedUsername || !expectedPassword) {
    return addStagingHeaders(
      new NextResponse("Staging access is not configured.", { status: 503 }),
    );
  }

  const credentials = decodeBasicCredentials(request.headers.get("authorization"));
  const isAuthorized =
    credentials &&
    constantTimeEqual(credentials.username, expectedUsername) &&
    constantTimeEqual(credentials.password, expectedPassword);

  if (isAuthorized) {
    return null;
  }

  const response = new NextResponse("Authentication required.", { status: 401 });
  response.headers.set(
    "WWW-Authenticate",
    'Basic realm="AIS Staging", charset="UTF-8"',
  );
  return addStagingHeaders(response);
}

export function middleware(request) {
  const pathname = request.nextUrl.pathname;
  const stagingRequest = isStagingRequest(request);

  if (stagingRequest && pathname === "/robots.txt") {
    return addStagingHeaders(
      new NextResponse(STAGING_ROBOTS_POLICY, {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      }),
    );
  }

  if (stagingRequest && pathname === "/sitemap.xml") {
    return addStagingHeaders(new NextResponse("Not Found", { status: 404 }));
  }

  if (stagingRequest) {
    const authResponse = stagingAuthResponse(request);
    if (authResponse) {
      return authResponse;
    }
  }

  const respond = (response) =>
    stagingRequest ? addStagingHeaders(response) : response;

  if (pathname === "/product-detail") {
    const rawQuery = request.nextUrl.search.replace(/^\?/, "");
    const redirectUrl = request.nextUrl.clone();
    if (rawQuery) {
      const decoded = decodeURIComponent(rawQuery);
      const slug = decoded
        .trim()
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u2013\u2014]/g, "-")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      redirectUrl.pathname = slug ? `/products/${slug}` : "/parts";
    } else {
      redirectUrl.pathname = "/parts";
    }
    redirectUrl.search = "";
    return respond(NextResponse.redirect(redirectUrl, 308));
  }

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/assets") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    return respond(NextResponse.next());
  }

  const ua = (request.headers.get("user-agent") || "").toLowerCase();
  if (!ua) {
    return respond(new NextResponse("Forbidden", { status: 403 }));
  }

  const isKnownGoodBot = KNOWN_GOOD_BOTS.some((bot) => ua.includes(bot));
  if (isKnownGoodBot) {
    return respond(NextResponse.next());
  }

  const looksAutomated = LIKELY_AUTOMATION_UA.some((pattern) => ua.includes(pattern));
  if (looksAutomated) {
    return respond(new NextResponse("Forbidden", { status: 403 }));
  }

  return respond(NextResponse.next());
}

export const config = {
  matcher: [
    "/robots.txt",
    "/sitemap.xml",
    "/((?!_next/static|_next/image|.*\\..*).*)",
  ],
};
