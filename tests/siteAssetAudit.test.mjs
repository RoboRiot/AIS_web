import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { extractInternalResources, verifySiteAssets } from "../scripts/verify-site-assets.mjs";

const origin = "https://example.test";
const extract = (html) => extractInternalResources(html, `${origin}/products/example`, origin);

test("asset audit ignores partial Next flight strings, JSON data and comments", () => {
  const html = `<img src="/assets/images/bannerslider5.jpg">
    <script>self.__next_f.push([1,"/assets/images/bannerslid"])</script>
    <script>self.__next_f.push([1,"er5.jpg /assets/i"])</script>
    <script type="application/ld+json">{"image":"/assets/not-rendered.jpg"}</script>
    <!-- <img src="/assets/commented.png"> -->
    <div data-note="/assets/not-a-resource.png">/assets/plain-text.png</div>`;
  assert.deepEqual(extract(html), [`${origin}/assets/images/bannerslider5.jpg`]);
});

test("asset audit keeps complete decoded URLs, scripts, preload and responsive images", () => {
  const urls = extract(`<link rel="stylesheet" href="/_next/static/site.css?dpl=one&amp;v=2">
    <script src="/_next/static/app.js"></script>
    <link rel="preload" as="image" imagesrcset="/assets/small.jpg 1x, /assets/large.jpg 2x">
    <img src="/assets/full,photo.jpg?x=1&amp;y=2" srcset="/assets/one.jpg, /assets/two.jpg">
    <source srcset="data:image/svg+xml;base64,AAAA 1x, /assets/fallback.jpg 2x">
    <img src="/_next/image?url=%2Fassets%2Ftest.jpg&amp;w=640&amp;q=75">
    <video poster="/assets/poster.jpg" src="https://other.test/assets/video.mp4"></video>
    <style>.hero { background: url('/assets/bg.jpg') }</style>
    <div style="background-image:url(&quot;/assets/inline.jpg&quot;)"></div>`);
  assert.deepEqual(new Set(urls), new Set([
    `${origin}/_next/static/site.css?dpl=one&v=2`, `${origin}/_next/static/app.js`,
    ...["small.jpg", "large.jpg", "full,photo.jpg?x=1&y=2", "one.jpg", "two.jpg", "fallback.jpg", "poster.jpg", "bg.jpg", "inline.jpg"].map((file) => `${origin}/assets/${file}`),
    `${origin}/_next/image?url=%2Fassets%2Ftest.jpg&w=640&q=75`,
  ]));
});

test("actual rendered truncated paths and incomplete optimizer URLs are not suppressed", () => {
  assert.deepEqual(extract('<img src="/assets/i"><img src="/_next/image?url=test">'), [
    `${origin}/assets/i`, `${origin}/_next/image?url=test`,
  ]);
});

test("asset audit still reports genuine HTTP failures, not RSC fragments", async () => {
  const requested = [];
  const server = createServer((request, response) => {
    requested.push(request.url);
    if (request.url === "/sitemap.xml") {
      response.setHeader("content-type", "application/xml");
      return response.end("<urlset><url><loc>/</loc></url></urlset>");
    }
    if (request.url === "/") {
      response.setHeader("content-type", "text/html");
      return response.end('<img src="/assets/missing.png"><script>self.__next_f.push([1,"/assets/i"])</script>');
    }
    response.writeHead(404, { "content-type": "text/plain" }).end("Not found");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const report = await verifySiteAssets({ baseUrl: `http://127.0.0.1:${server.address().port}`, concurrency: 1 });
    assert.equal(report.pageFailures.length, 0);
    assert.deepEqual(report.assetFailures.map((failure) => [new URL(failure.resourceUrl).pathname, failure.status]), [["/assets/missing.png", 404]]);
    assert.ok(!requested.includes("/assets/i"));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
