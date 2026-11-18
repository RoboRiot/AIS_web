import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { NextRequest } from "next/server.js";

const require = createRequire(import.meta.url);
let source = await readFile(new URL("../middleware.js", import.meta.url), "utf8");
for (const [specifier, url] of [
  ["next/server", pathToFileURL(require.resolve("next/server.js")).href],
  ["./app/data/rscDeploymentPolicy.mjs", new URL("../app/data/rscDeploymentPolicy.mjs", import.meta.url).href],
  ["./site.config.mjs", new URL("../site.config.mjs", import.meta.url).href],
]) source = source.replace(`from "${specifier}"`, `from "${url}"`);
const { middleware } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

test("same-host legacy redirects cannot expose a Node middleware internal origin", () => {
  for (const host of ["advancedimagingparts.com", "127.0.0.1:3098", "localhost:3098"]) {
    for (const [route, expected] of [
      ["/Parts?utm_source=origin-check", "/parts?utm_source=origin-check"],
      ["/product-detail?MRI%20Coil%20123", "/products/mri-coil-123"],
      ["/product-detail", "/parts"],
    ]) {
      const request = new NextRequest(`http://localhost:3098${route}`, { headers: { host, "user-agent": "AIS-Release-Verification/1.0" } });
      const response = middleware(request);
      assert.equal(response.status, 308);
      assert.equal(response.headers.get("location"), expected);
      assert.equal(new URL(response.headers.get("location"), `https://${host}`).host, host);
    }
  }
});

test("unrecognized host safeguards still run before legacy redirects", () => {
  const response = middleware(new NextRequest("http://localhost:3098/Parts", { headers: { host: "unrecognized.invalid", "user-agent": "AIS-Release-Verification/1.0" } }));
  assert.equal(response.status, 421);
  assert.equal(response.headers.get("location"), null);
});
