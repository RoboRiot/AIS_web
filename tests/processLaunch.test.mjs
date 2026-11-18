import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

test("PM2 supervises the actual Node process and refuses mismatched build IDs", (t) => {
  const root = mkdtempSync(path.join(tmpdir(), "ais-launch-"));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(tmpdir()));
    assert.ok(path.basename(root).startsWith("ais-launch-"));
    rmSync(root, { recursive: true, force: true });
  });
  const dist = path.join(root, ".next-releases", "test-release");
  mkdirSync(dist, { recursive: true });
  writeFileSync(path.join(dist, "BUILD_ID"), "test-release");
  const env = { ...process.env, AIS_APP_ROOT: root, AIS_RELEASE_ID: "test-release", AIS_PORT: "3097" };
  const result = JSON.parse(execFileSync(process.execPath, ["-e", "console.log(JSON.stringify(require('./ecosystem.config.cjs')))"], { env, encoding: "utf8" }));
  const app = result.apps[0];
  assert.equal(app.interpreter, process.execPath);
  assert.ok(app.script.endsWith(path.join("next", "dist", "bin", "next")));
  assert.deepEqual(app.args, ["start", "-H", "127.0.0.1", "-p", "3097"]);
  assert.equal(app.max_memory_restart, "450M");
  writeFileSync(path.join(dist, "BUILD_ID"), "different-release");
  assert.throws(() => execFileSync(process.execPath, ["-e", "require('./ecosystem.config.cjs')"], { env, stdio: "pipe" }), /Release build ID does not match/);
});
