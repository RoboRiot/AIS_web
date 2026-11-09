import assert from "node:assert/strict";
import test from "node:test";
import { guardRscDeployment } from "../app/data/rscDeploymentPolicy.mjs";
const requestWith = (headers, method = "GET") => ({ headers: new Headers(headers), method });

test("different deployment RSC is stopped before any Flight body is decoded", async () => {
  const response = guardRscDeployment(
    requestWith({ "x-deployment-id": "previous-release" }),
    "current-release",
    new Response("incompatible Flight body", { headers: { "Content-Type": "text/x-component" } }),
  );
  assert.equal(response.status, 204);
  assert.equal(response.body, null);
  assert.equal(response.headers.get("Content-Type"), null);
  assert.equal(response.headers.get("X-AIS-Navigation-Reload"), "deployment-mismatch");
  assert.match(response.headers.get("Cache-Control"), /no-store/);
  assert.equal(response.headers.get("Vary"), "x-deployment-id");
});

test("matching RSC continues with its body, framework headers, and deployment cache variation", async () => {
  const original = new Response("current Flight body", {
    headers: { "Content-Type": "text/x-component", Vary: "RSC, Next-Router-State-Tree", "x-middleware-next": "1" },
  });
  const response = guardRscDeployment(requestWith({ "x-deployment-id": "current" }), "current", original);
  assert.equal(response, original);
  assert.equal(await response.text(), "current Flight body");
  assert.equal(response.headers.get("x-middleware-next"), "1");
  assert.equal(response.headers.get("Vary"), "RSC, Next-Router-State-Tree, x-deployment-id");
  assert.equal(response.headers.get("Cache-Control"), "private, no-store, max-age=0");
});

test("ordinary document requests retain their original cache behavior even with a deployment header", () => {
  for (const headers of [{ accept: "text/html,application/xhtml+xml" }, { "sec-fetch-dest": "document" }]) {
    const original = new Response("HTML", { headers: { "Cache-Control": "public, max-age=300" } });
    const response = guardRscDeployment(requestWith({ "x-deployment-id": "previous", ...headers }), "current", original);
    assert.equal(response, original);
    assert.equal(response.headers.get("Cache-Control"), "public, max-age=300");
    assert.equal(response.headers.get("Vary"), null);
  }
});

test("missing deployment identifiers remain compatible and existing Vary is preserved", () => {
  for (const [headers, deploymentId] of [[{ rsc: "1" }, "current"], [{ "x-deployment-id": "current" }, undefined]]) {
    const original = new Response("Flight", { headers: { Vary: "RSC, X-Deployment-ID" } });
    const response = guardRscDeployment(requestWith(headers), deploymentId, original);
    assert.equal(response, original);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Vary"), "RSC, X-Deployment-ID");
    if (headers["x-deployment-id"]) assert.match(response.headers.get("Cache-Control"), /no-store/);
    else assert.equal(response.headers.get("Cache-Control"), null);
  }
});

test("HEAD navigation with stripped Flight headers receives the same mismatch protection", () => {
  const response = guardRscDeployment(requestWith({ "x-deployment-id": "old" }, "HEAD"), "current", new Response(null));
  assert.equal(response.status, 204);
  assert.equal(response.body, null);
});

test("form and Server Action methods are never discarded by the navigation guard", async () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const original = new Response("action result", { headers: { "x-middleware-next": "1" } });
    const response = guardRscDeployment(requestWith({ rsc: "1", "x-deployment-id": "previous" }, method), "current", original);
    assert.equal(response, original);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), null);
  }
});
