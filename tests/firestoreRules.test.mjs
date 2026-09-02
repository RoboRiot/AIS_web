import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readWorkspaceFile = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("both Firebase deploy configurations include the checked-in rules", () => {
  for (const path of ["firebase.json", "firebase.catalog.json"]) {
    const config = JSON.parse(readWorkspaceFile(path));
    assert.equal(config.firestore.rules, "firestore.rules", path);
  }
});

test("the Parts collection no longer permits anonymous Firestore reads", () => {
  const rules = readWorkspaceFile("firestore.rules");
  const partsMatch = rules.match(
    /match \/Parts\/\{document=\*\*\} \{([\s\S]*?)\n    \}/,
  );

  assert.ok(partsMatch, "Parts rules block is missing");
  assert.match(partsMatch[1], /allow read: if approvedUser\(\);/);
  assert.doesNotMatch(rules, /allow read: if true;/);
});
