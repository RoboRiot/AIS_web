const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");
const path = require("node:path");

// Fail closed if npm lifecycle scripts were skipped or the pinned backport drifted.
module.exports = function verifyRuntimeMemoryFixes() {
  const packagePath = require.resolve("next/package.json");
  assert.equal(JSON.parse(readFileSync(packagePath, "utf8")).version, "15.5.29", "Review the memory backport when upgrading Next");
  const expected = {
    "dist/server/lib/lru-cache.js": "5a1d6d64372eb4e27ab5ef0ad3e4585fbe6f34bc6b1e3c0fefccd4eb950663dd",
    "dist/esm/server/lib/lru-cache.js": "af40fd13476305d18fe5823799f26e400f8b416b98e8cf26be84af0c600ea2fd",
    "dist/server/lib/router-utils/filesystem.js": "a4dde8ce24dbc6022913b83604f55a3ece936031572926a1acb50311050f4304",
    "dist/esm/server/lib/router-utils/filesystem.js": "bb79b910f8e6f80a59a9407cfd8173eeb0a27243758e092733cb8bf186d85977",
  };
  for (const [file, hash] of Object.entries(expected)) {
    const source = readFileSync(path.join(path.dirname(packagePath), file), "utf8").replace(/\r\n/g, "\n");
    assert.equal(createHash("sha256").update(source).digest("hex"), hash, `Missing or modified memory backport: ${file}. Run npm ci with lifecycle scripts enabled.`);
  }
  return true;
};

if (require.main === module) {
  module.exports();
  console.log("Verified pinned Next route-cache memory backport");
}
