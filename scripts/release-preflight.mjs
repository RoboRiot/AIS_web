import assert from "node:assert/strict";
import { statfsSync, readFileSync, realpathSync } from "node:fs";
import { execFileSync } from "node:child_process";

// Read-only gate, safe to run before staging. It does not delete caches, restart
// processes, fetch code, change a release pointer or print environment secrets.
const root = realpathSync(process.argv[2] || process.cwd());
const disk = statfsSync(root);
const freeBytes = disk.bavail * disk.bsize;
const minimumBytes = 4 * 1024 ** 3;
const revision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { cwd: root, encoding: "utf8" }).trim();
let availableMemory = null;
if (process.platform === "linux") availableMemory = Number(readFileSync("/proc/meminfo", "utf8").match(/^MemAvailable:\s+(\d+)/m)?.[1]) * 1024;
console.log(JSON.stringify({ root, revision, trackedChanges: !!dirty, freeBytes, availableMemory, minimumBytes }, null, 2));
assert.equal(dirty, "", "Stage only a clean, pinned revision, never build over the active checkout");
assert.ok(freeBytes >= minimumBytes, "Insufficient disk headroom for a staged release and rollback; require at least 4 GiB free");
if (availableMemory != null) assert.ok(availableMemory >= 512 * 1024 ** 2, "Insufficient available RAM for an on-host build; build on a separate Linux builder");
