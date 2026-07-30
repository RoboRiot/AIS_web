import {
  PRODUCTION_HOSTNAME,
  PRODUCTION_HOST_ALIASES,
} from "../../site.config.mjs";

const ANALYTICS_HOSTS = new Set([
  PRODUCTION_HOSTNAME,
  ...PRODUCTION_HOST_ALIASES,
]);

const AUTOMATION_USER_AGENT_MARKERS = [
  "bot",
  "crawler",
  "spider",
  "crawling",
  "slurp",
  "google-inspectiontool",
  "lighthouse",
  "pagespeed",
  "headless",
  "phantomjs",
  "selenium",
  "playwright",
  "puppeteer",
  "python-requests",
  "scrapy",
  "go-http-client",
  "libwww",
  "curl/",
  "wget/",
  "httpclient",
  "node-fetch",
  "axios",
  "java/",
  "facebookexternalhit",
  "linkedinbot",
  "twitterbot",
  "bingpreview",
  "preview",
  "monitor",
  "uptimerobot",
  "pingdom",
  "datadog",
  "newrelic",
  "ahrefs",
  "semrush",
  "mj12",
  "dotbot",
  "petalbot",
];

export const normalizeAnalyticsHostname = (value) =>
  String(value || "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");

export const isProductionAnalyticsHost = (value) =>
  ANALYTICS_HOSTS.has(normalizeAnalyticsHostname(value));

export const isAutomatedUserAgent = (value) => {
  const userAgent = String(value || "").trim().toLowerCase();
  return (
    !userAgent ||
    AUTOMATION_USER_AGENT_MARKERS.some((marker) => userAgent.includes(marker))
  );
};

export const shouldCollectBrowserAnalytics = ({
  hostname,
  userAgent,
  webdriver = false,
}) =>
  isProductionAnalyticsHost(hostname) &&
  !webdriver &&
  !isAutomatedUserAgent(userAgent);
