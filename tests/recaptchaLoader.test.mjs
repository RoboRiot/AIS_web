import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = (await readFile(new URL("../components/utils/recaptcha.js", import.meta.url), "utf8"))
  .replaceAll("export const ", "const ");

function fixture(hostname = "advancedimagingparts.com") {
  const nodes = [];
  const timers = new Map();
  const queued = [];
  let sequence = 0;
  let executions = 0;
  let resets = 0;
  let renders = 0;
  let renderFrames = true;
  const observers = new Set();
  const clients = [];
  const notify = () => [...observers].forEach((observer) => observer.callback());
  const element = () => ({
    children: [], parent: null, src: "", tag: "div",
    get isConnected() { return this === host || Boolean(this.parent?.isConnected); },
    querySelector() {
      for (const child of this.children) {
        if (child.tag === "iframe" && child.src.includes("/recaptcha/")) return child;
        const found = child.querySelector();
        if (found) return found;
      }
      return null;
    },
    replaceChildren(...children) {
      this.children.forEach((child) => { child.parent = null; });
      this.children = children;
      children.forEach((child) => { child.parent = this; });
      notify();
    },
  });
  const host = element();
  host.id = "ais-recaptcha-host";
  const attachFrame = (mount) => {
    const frame = element();
    frame.tag = "iframe";
    frame.src = "https://www.google.com/recaptcha/api2/anchor";
    mount.replaceChildren(frame);
  };
  const render = (element, options) => {
    assert.equal(element.parent, host);
    renders++;
    clients.push({ mount: element, options });
    if (renderFrames) attachFrame(element);
    return clients.length - 1;
  };
  const window = {
    location: { hostname },
    setTimeout(fn) { const id = ++sequence; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; }
      observe() { observers.add(this); }
      disconnect() { observers.delete(this); }
    },
  };
  const document = {
    getElementById: (id) => id === host.id ? host : nodes.find((node) => node.id === id && !node.removed),
    createElement(tag) {
      if (tag !== "script") return element();
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
  vm.runInContext(`${source}\nthis.api = { ensureRecaptchaScript, executeRecaptcha, retryRecaptcha, subscribeRecaptchaStatus };`, context);
  return { window, document, nodes, timers, queued, clients, observers, host, api: context.api,
    get executions() { return executions; },
    get resets() { return resets; },
    get renders() { return renders; },
    set renderFrames(value) { renderFrames = value; },
    failWidget(index = clients.length - 1) { clients[index].options["error-callback"](); },
    removeFrame() { clients.at(-1).mount.replaceChildren(element()); },
    restoreFrame() { attachFrame(clients.at(-1).mount); },
    bootstrap() {
      window.grecaptcha = { ready: (callback) => queued.push(callback) };
      nodes.at(-1).emit("load");
    },
    ready() {
      window.grecaptcha.render = render;
      window.grecaptcha.reset = (id) => { assert.ok(clients[id]); resets++; };
      window.grecaptcha.execute = async (id) => { assert.equal(id, clients.length - 1); executions++; return "fixture-only-token"; };
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
  assert.equal(f.nodes[0].src, "https://www.recaptcha.net/recaptcha/api.js?render=explicit");
  assert.equal(f.nodes[0].removed, false);
  f.ready();
  assert.equal(await first, true);
  assert.equal(f.timers.size, 0);
});

test("loopback previews cannot load a production key or produce submission tokens", async () => {
  for (const hostname of ["localhost", "127.0.0.1", "[::1]", "preview.localhost"]) {
    const f = fixture(hostname);
    const statuses = [];
    f.api.subscribeRecaptchaStatus((status) => statuses.push(status));
    assert.equal(await f.api.ensureRecaptchaScript("fixture-key"), false);
    assert.equal(await f.api.executeRecaptcha("fixture-key", "contact_form"), null);
    assert.equal(f.nodes.length, 0);
    assert.equal(f.executions, 0);
    assert.equal(statuses.at(-1), "local-preview");
  }
});

test("alternate reCAPTCHA transport is explicitly allowed by CSP", async () => {
  const { default: config } = await import("../next.config.mjs");
  const headers = await config("phase-development-server").headers();
  const csp = headers.find((entry) => entry.source === "/(.*)").headers.find((header) => header.key === "Content-Security-Policy").value;
  for (const directive of ["script-src", "frame-src", "connect-src"]) {
    assert.match(csp.split("; ").find((entry) => entry.startsWith(`${directive} `)), /https:\/\/www\.recaptcha\.net\/recaptcha\//);
  }
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
  f.window.grecaptcha = {};
  f.ready();
  assert.equal(await f.api.executeRecaptcha("fixture-key", "trailer_request"), "fixture-only-token");
  assert.equal(f.nodes.length, 0);
  f.window.grecaptcha.execute = async () => { throw new Error("offline"); };
  assert.equal(await f.api.executeRecaptcha("fixture-key", "trailer_request"), null);
  f.window.grecaptcha.execute = () => { throw new Error("unavailable"); };
  assert.equal(await f.api.executeRecaptcha("fixture-key", "trailer_request"), null);
});

test("one persistent explicit v3 widget is reused across form mounts", async () => {
  const f = fixture();
  const first = f.api.ensureRecaptchaScript("fixture-key");
  assert.match(f.nodes[0].src, /render=explicit$/);
  f.bootstrap();
  f.ready();
  assert.equal(await first, true);
  assert.equal(await f.api.ensureRecaptchaScript("fixture-key"), true);
  assert.equal(f.renders, 1);
  assert.equal(f.nodes.length, 1);
  assert.equal(f.executions, 0);
});

test("late widget connection failure is reported and user retry resets only that client", async () => {
  const f = fixture();
  const states = [];
  const unsubscribe = f.api.subscribeRecaptchaStatus((state) => states.push(state));
  const first = f.api.ensureRecaptchaScript("fixture-key");
  f.bootstrap();
  f.ready();
  await first;
  f.failWidget();
  assert.equal(states.at(-1), "error");
  assert.equal(await f.api.retryRecaptcha("fixture-key"), true);
  assert.equal(states.at(-1), "retry-ready");
  assert.equal(f.resets, 1);
  assert.equal(f.executions, 0, "retry must not create a token or submit a lead");
  assert.equal(f.renders, 1);
  assert.equal(f.nodes[0].removed, false);
  assert.equal(await f.api.executeRecaptcha("fixture-key", "trailer_request"), "fixture-only-token");
  assert.equal(states.at(-1), "idle");
  unsubscribe();
  f.failWidget();
  assert.equal(states.at(-1), "idle");
});

test("submit retries a failed widget once and still fails closed if reset fails", async () => {
  const f = fixture();
  const first = f.api.ensureRecaptchaScript("fixture-key");
  f.bootstrap();
  f.ready();
  await first;
  f.failWidget();
  assert.equal(await f.api.executeRecaptcha("fixture-key", "trailer_request"), "fixture-only-token");
  assert.equal(f.resets, 1);
  f.failWidget();
  f.window.grecaptcha.reset = () => { throw new Error("offline"); };
  assert.equal(await f.api.executeRecaptcha("fixture-key", "trailer_request"), null);
  assert.equal(f.executions, 1);
  assert.equal(await f.api.executeRecaptcha("different-key", "trailer_request"), null);
});

async function loadedFixture() {
  const f = fixture();
  const loaded = f.api.ensureRecaptchaScript("fixture-key");
  f.bootstrap();
  f.ready();
  assert.equal(await loaded, true);
  return f;
}

test("iframe replaced by error text without callback exposes error and rebuilds only widget", async () => {
  const f = await loadedFixture();
  const states = [];
  f.api.subscribeRecaptchaStatus((state) => states.push(state));
  const oldMount = f.clients[0].mount;
  f.removeFrame();
  f.expire();
  assert.equal(states.at(-1), "error");
  assert.equal(await f.api.retryRecaptcha("fixture-key"), true);
  assert.equal(states.at(-1), "retry-ready");
  assert.equal(f.renders, 2);
  assert.equal(f.resets, 1);
  assert.equal(oldMount.isConnected, false);
  assert.equal(f.host.children.length, 1);
  assert.equal(f.observers.size, 1);
  assert.equal(f.nodes.length, 1);
  assert.equal(f.nodes[0].removed, false);
  assert.equal(f.executions, 0);
  assert.equal(await f.api.executeRecaptcha("fixture-key", "trailer_request"), "fixture-only-token");
});

test("brief iframe replacement does not produce a false error", async () => {
  const f = await loadedFixture();
  const states = [];
  f.api.subscribeRecaptchaStatus((state) => states.push(state));
  f.removeFrame();
  f.restoreFrame();
  f.expire();
  assert.deepEqual(states, ["idle"]);
  assert.equal(f.renders, 1);
});

test("no initial frame and a failed rebuild time out without reporting recovery", async () => {
  const f = fixture();
  f.renderFrames = false;
  const states = [];
  f.api.subscribeRecaptchaStatus((state) => states.push(state));
  const loaded = f.api.ensureRecaptchaScript("fixture-key");
  f.bootstrap();
  f.ready();
  await loaded;
  f.expire();
  assert.equal(states.at(-1), "error");
  const retry = f.api.retryRecaptcha("fixture-key");
  await Promise.resolve();
  f.expire();
  assert.equal(await retry, false);
  assert.equal(states.at(-1), "error");
  assert.equal(f.renders, 2, "no automatic render loop");
  assert.equal(f.executions, 0);
});

test("concurrent retries share one rebuild and ignore callbacks from the retired client", async () => {
  const f = await loadedFixture();
  const states = [];
  f.api.subscribeRecaptchaStatus((state) => states.push(state));
  f.removeFrame();
  f.expire();
  const first = f.api.retryRecaptcha("fixture-key");
  assert.equal(first, f.api.retryRecaptcha("fixture-key"));
  assert.equal(await first, true);
  f.failWidget(0);
  assert.equal(states.at(-1), "retry-ready");
  assert.equal(f.renders, 2);
  assert.equal(f.executions, 0);
});

test("a disconnected client can be rebuilt even when its old reset throws", async () => {
  const f = await loadedFixture();
  f.removeFrame();
  f.expire();
  f.window.grecaptcha.reset = () => { throw new Error("Frame is detached"); };
  assert.equal(await f.api.retryRecaptcha("fixture-key"), true);
  assert.equal(f.renders, 2);
  assert.equal(f.executions, 0);
});

test("submission catches a missing frame before the observer grace timer expires", async () => {
  const f = await loadedFixture();
  f.removeFrame();
  assert.equal(await f.api.executeRecaptcha("fixture-key", "trailer_request"), "fixture-only-token");
  assert.equal(f.renders, 2);
  assert.equal(f.executions, 1);
});

test("late tokens from retired clients cannot clear the current failure", async () => {
  const f = await loadedFixture();
  let complete;
  f.window.grecaptcha.execute = () => new Promise((resolve) => { complete = resolve; });
  const token = f.api.executeRecaptcha("fixture-key", "trailer_request");
  await Promise.resolve();
  f.removeFrame();
  assert.equal(await f.api.retryRecaptcha("fixture-key"), true);
  f.failWidget();
  complete("stale-fixture-token");
  assert.equal(await token, null);
  const states = [];
  f.api.subscribeRecaptchaStatus((state) => states.push(state));
  assert.equal(states.at(-1), "error");
});

test("missing persistent host and failed explicit rendering cannot report ready", async () => {
  for (const failure of ["host", "render"]) {
    const f = fixture();
    if (failure === "host") f.document.getElementById = () => null;
    const first = f.api.ensureRecaptchaScript("fixture-key");
    f.bootstrap();
    f.window.grecaptcha.render = () => { throw new Error("render failed"); };
    f.window.grecaptcha.execute = async () => "fixture-only-token";
    f.queued.splice(0).forEach((callback) => callback());
    assert.equal(await first, false);
    assert.equal(f.executions, 0);
  }
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
