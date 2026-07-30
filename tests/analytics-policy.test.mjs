import test from "node:test";
import assert from "node:assert/strict";

import {
  isAutomatedUserAgent,
  isProductionAnalyticsHost,
  normalizeAnalyticsHostname,
  shouldCollectBrowserAnalytics,
} from "../app/data/analyticsPolicy.mjs";

const chromeUserAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

test("normalizes hostnames before evaluating analytics traffic", () => {
  assert.equal(
    normalizeAnalyticsHostname("ADVANCEDIMAGINGPARTS.COM:443"),
    "advancedimagingparts.com",
  );
  assert.equal(
    normalizeAnalyticsHostname("www.advancedimagingparts.com."),
    "www.advancedimagingparts.com",
  );
});

test("only the canonical production hosts are eligible for analytics", () => {
  assert.equal(isProductionAnalyticsHost("advancedimagingparts.com"), true);
  assert.equal(isProductionAnalyticsHost("www.advancedimagingparts.com"), true);
  assert.equal(isProductionAnalyticsHost("advancedimagingparts.com:443"), true);
  assert.equal(isProductionAnalyticsHost("advancedimaging.duckdns.org"), false);
  assert.equal(isProductionAnalyticsHost("164.92.111.36"), false);
  assert.equal(isProductionAnalyticsHost("localhost:3000"), false);
});

test("detects search crawlers and automated browser traffic", () => {
  const automatedAgents = [
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    "Mozilla/5.0 AppleWebKit/537.36 HeadlessChrome/138.0.0.0 Safari/537.36",
    "python-requests/2.32.3",
    "Mozilla/5.0 Selenium/4.21",
    "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)",
  ];

  automatedAgents.forEach((userAgent) => {
    assert.equal(isAutomatedUserAgent(userAgent), true, userAgent);
  });
  assert.equal(isAutomatedUserAgent(chromeUserAgent), false);
});

test("collects browser analytics only for human production traffic", () => {
  assert.equal(
    shouldCollectBrowserAnalytics({
      hostname: "advancedimagingparts.com",
      userAgent: chromeUserAgent,
      webdriver: false,
    }),
    true,
  );
  assert.equal(
    shouldCollectBrowserAnalytics({
      hostname: "advancedimaging.duckdns.org",
      userAgent: chromeUserAgent,
      webdriver: false,
    }),
    false,
  );
  assert.equal(
    shouldCollectBrowserAnalytics({
      hostname: "advancedimagingparts.com",
      userAgent: "Googlebot/2.1",
      webdriver: false,
    }),
    false,
  );
  assert.equal(
    shouldCollectBrowserAnalytics({
      hostname: "advancedimagingparts.com",
      userAgent: chromeUserAgent,
      webdriver: true,
    }),
    false,
  );
});
