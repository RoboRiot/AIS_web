import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

test("release verification remains responsive between its subprocess gates", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "ais-verifier-"));
  const server = createServer((_request, response) => {
    response.setHeader("x-ais-release", "synthetic-release");
    response.end("synthetic homepage");
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    await mkdir(path.join(directory, "scripts"));
    const source = await readFile(new URL("../scripts/verify-release.mjs", import.meta.url), "utf8");
    // Timers must run while child gates execute, allowing fetch to retire idle sockets.
    await writeFile(path.join(directory, "scripts/verify-release.mjs"),
      "globalThis.verifierTicks = 0; setInterval(() => globalThis.verifierTicks++, 20).unref();\n" + source);
    for (const name of ["verify-legacy-product-redirects", "verify-health-repairs", "verify-sitemaps"]) {
      await writeFile(path.join(directory, `scripts/${name}.mjs`), "setTimeout(() => {}, 150);\n");
    }
    await writeFile(path.join(directory, "scripts/verify-site-assets.mjs"), `
      import assert from 'node:assert/strict';
      export async function verifySiteAssets() {
        assert(globalThis.verifierTicks >= 3, 'Verifier blocked its event loop during child gates');
        return { pageFailures: [], assetFailures: [], releases: ['synthetic-release'],
          pageResults: [{}], resourceResults: [{}] };
      }
    `);
    const result = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ["scripts/verify-release.mjs",
        `http://127.0.0.1:${server.address().port}`, "synthetic-release", "result.json"], { cwd: directory });
      let output = "";
      child.stdout.on("data", chunk => { output += chunk; });
      child.stderr.on("data", chunk => { output += chunk; });
      child.once("error", reject);
      child.once("close", code => resolve({ code, output }));
    });
    assert.equal(result.code, 0, result.output);
    const report = JSON.parse(await readFile(path.join(directory, "result.json"), "utf8"));
    assert.equal(report.httpVerified, true);
    assert.equal(report.expectedRelease, "synthetic-release");
    assert.equal(report.browserVerified, false);
    assert.equal(report.leadDeliveryVerified, false);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
