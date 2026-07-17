import { NextResponse } from "next/server";

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

export function middleware(request) {
  const pathname = request.nextUrl.pathname;

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
    return NextResponse.redirect(redirectUrl, 308);
  }

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/assets") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    return NextResponse.next();
  }

  const ua = (request.headers.get("user-agent") || "").toLowerCase();
  if (!ua) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const isKnownGoodBot = KNOWN_GOOD_BOTS.some((bot) => ua.includes(bot));
  if (isKnownGoodBot) {
    return NextResponse.next();
  }

  const looksAutomated = LIKELY_AUTOMATION_UA.some((pattern) => ua.includes(pattern));
  if (looksAutomated) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
