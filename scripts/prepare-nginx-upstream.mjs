import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function prepareNginxUpstream(source) {
  if (!/^\s*server_name\s+advancedimagingparts\.com\s+www\.advancedimagingparts\.com\s*;/m.test(source)) {
    throw new Error("Unexpected nginx server name; refusing to prepare a patch.");
  }
  const directive = /^(\s*proxy_pass\s+)http:\/\/localhost:3000(\s*;[^\r\n]*)$/gm;
  if ([...source.matchAll(directive)].length !== 1) {
    throw new Error("Expected exactly one localhost:3000 proxy directive; inspect drift manually.");
  }
  return source.replace(directive, "$1http://127.0.0.1:3000$2");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output || path.resolve(input) === path.resolve(output)) throw new Error("Usage: prepare-nginx-upstream.mjs INPUT DISTINCT_NEW_CANDIDATE");
  const candidate = prepareNginxUpstream(await fs.readFile(input, "utf8"));
  await fs.writeFile(output, candidate, { flag: "wx", mode: 0o600 });
  console.log("Candidate prepared only. Active nginx configuration has not been replaced or reloaded.");
}
