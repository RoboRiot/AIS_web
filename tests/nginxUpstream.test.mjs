import test from "node:test";
import assert from "node:assert/strict";
import { prepareNginxUpstream } from "../scripts/prepare-nginx-upstream.mjs";

test("nginx candidate changes only the exact main-site upstream", () => {
  const source = "server {\n server_name advancedimagingparts.com www.advancedimagingparts.com;\n location / {\n  proxy_pass http://localhost:3000; # main app\n }\n listen 443 ssl;\n}\n";
  assert.equal(prepareNginxUpstream(source), source.replace("http://localhost:3000", "http://127.0.0.1:3000"));
  assert.throws(() => prepareNginxUpstream(source.replace("advancedimagingparts.com", "other.test")), /server name/);
  assert.throws(() => prepareNginxUpstream(source + "proxy_pass http://localhost:3000;\n"), /exactly one/);
  assert.throws(() => prepareNginxUpstream(source.replace("localhost", "127.0.0.1")), /exactly one/);
});
