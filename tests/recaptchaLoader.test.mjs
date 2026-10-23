import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = (await readFile(new URL("../components/utils/recaptcha.js", import.meta.url), "utf8"))
  .replaceAll("export const ", "const ");

function fixture() {
  const nodes = [];
  const timers = new Map();
  const queued = [];
  let sequence = 0;
  let executions = 0;
  const window = {
    setTimeout(fn) { const id = ++sequence; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  const document = {
    getElementById: (id) => nodes.find((node) => node.id === id && !node.removed),
    createElement() {
      const listeners = new Map();
      return { dataset: {}, removed: false,
        addEventListener: (event, handler) => listeners.set(event, handler),
        removeEventListener: (event, handler) => { if (listeners.get(event) === handler) listeners.delete(event); },
        emit: (event) => listeners.get(event)?.(),
        remove() { this.removed = true; },
      };
    },
    head: { appendChild: (node) => nodes.push(node) },
  };
  const context = vm.createContext({ window, document });
  vm.runInContext(`${source}\nthis.api = { ensureRecaptchaScript, executeRecaptcha };`, context);
  return { window, document, nodes, timers, queued, api: context.api,
    get executions() { return executions; },
    bootstrap() {
      window.grecaptcha = { ready: (callback) => queued.push(callback) };
      nodes.at(-1).emit("load");
    },
    ready() {
      window.grecaptcha.execute = async () => { executions++; return "fixture-only-token"; };
      window.grecaptcha.ready = (callback) => callback();
      queued.splice(0).forEach((callback) => callback());
    },
    expire() { const pending = [...timers.values()]; timers.clear(); pending.forEach((callback) => callback()); },
  };
}

test("bootstrap load waits for Google's asynchronous ready callback", async () => {
  const f = fixture();
  const first = f.api.ensureRecaptchaScript("fixture-key");
  assert.equal(first, f.api.ensureRecaptchaScript("fixture-key"));
  f.bootstrap();
  let completed = false;
  first.then(() => { completed = true; });
  await Promise.resolve();
  assert.equal(completed, false);
  assert.equal(f.nodes.length, 1);
  assert.equal(f.nodes[0].removed, false);
  f.ready();
  assert.equal(await first, true);
  assert.equal(f.timers.size, 0);
});

test("ready timeout retains the bootstrap and retry uses the same API", async () => {
  const f = fixture();
  const first = f.api.ensureRecaptchaScript("fixture-key");
  f.bootstrap();
  f.expire();
  assert.equal(await first, false);
  assert.equal(f.nodes[0].removed, false);
  const retry = f.api.ensureRecaptchaScript("fixture-key");
  assert.equal(f.nodes.length, 1);
  f.ready();
  assert.equal(await retry, true);
});

test("network failure permits a bounded retry without leaving a failed script", async () => {
  for (const failure of ["error", "timeout"]) {
    const f = fixture();
    const first = f.api.ensureRecaptchaScript("fixture-key");
    if (failure === "error") f.nodes[0].emit("error");
    else f.expire();
    assert.equal(await first, false);
    assert.equal(f.nodes[0].removed, true);
    const retry = f.api.ensureRecaptchaScript("fixture-key");
    assert.equal(f.nodes.length, 2);
    f.bootstrap();
    f.ready();
    assert.equal(await retry, true);
  }
});

test("existing ready API is reused and token execution remains fail closed", async () => {
  const f = fixture();
  f.window.grecaptcha = { ready: (callback) => callback(), execute: async () => "fixture-only-token" };
  assert.equal(await f.api.executeRecaptcha("fixture-key", "trailer_request"), "fixture-only-token");
  assert.equal(f.nodes.length, 0);
  f.window.grecaptcha.execute = async () => { throw new Error("offline"); };
  assert.equal(await f.api.executeRecaptcha("fixture-key", "trailer_request"), null);
  f.window.grecaptcha.execute = () => { throw new Error("unavailable"); };
  assert.equal(await f.api.executeRecaptcha("fixture-key", "trailer_request"), null);
});

test("late ready callbacks do not execute after token timeout", async () => {
  const f = fixture();
  const setup = f.api.ensureRecaptchaScript("fixture-key");
  f.bootstrap();
  f.ready();
  await setup;
  f.window.grecaptcha.ready = (callback) => f.queued.push(callback);
  const token = f.api.executeRecaptcha("fixture-key", "trailer_request");
  await Promise.resolve();
  f.expire();
  assert.equal(await token, null);
  f.ready();
  assert.equal(f.executions, 0);
});

test("absent key, missing browser and blocked script insertion fail closed", async () => {
  const f = fixture();
  assert.equal(await f.api.ensureRecaptchaScript(""), false);
  f.document.head.appendChild = () => { throw new Error("blocked"); };
  assert.equal(await f.api.ensureRecaptchaScript("fixture-key"), false);
  const context = vm.createContext({});
  vm.runInContext(`${source}\nthis.api = { ensureRecaptchaScript };`, context);
  assert.equal(await context.api.ensureRecaptchaScript("fixture-key"), false);
});

test("inquiry and service forms label client verification errors separately", async () => {
  for (const file of ["components/forms/QuickInquiryForm.js", "app/service-request/ServiceRequestForm.js"]) {
    const text = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(text, /error\.code = "recaptcha_token"/);
    assert.match(text, /error\?\.code === "recaptcha_token" \? "recaptcha_token"/);
  }
});
