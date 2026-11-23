import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash, randomUUID } from "node:crypto";
import { XMLValidator } from "fast-xml-parser";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const transient = (status) => status === 408 || status === 429 || status >= 500;
const readJson = async (file) => {
  try { return JSON.parse(await fs.readFile(file, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
};

// Shared across worktrees and both CLI tools. A failed run cannot be immediately
// repeated by starting a second script. This state is local, never on the server.
export async function openMonitoringSession({ base, fetchImpl = fetch,
  directory = path.join(os.homedir(), ".ais-public-monitoring"),
  intervalMs = 2000, cooldownMs = 3600000, cacheMs = 21600000,
  now = Date.now, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  const origin = new URL(base);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  if (!loopback) intervalMs = Math.max(2000, intervalMs);
  const folder = path.join(directory, hash(origin.hostname.replace(/^www\./, "") + origin.port));
  await fs.mkdir(folder, { recursive: true });
  const lockPath = path.join(folder, "active.json");
  const cooldownPath = path.join(folder, "cooldown.json");
  const token = randomUUID();
  let handle;
  try { handle = await fs.open(lockPath, "wx"); }
  catch (error) {
    if (error.code === "EEXIST") throw new Error("A public monitoring run is already active for this host (or left a stale lock requiring local PID review).");
    throw error;
  }
  await handle.writeFile(JSON.stringify({ pid: process.pid, token }));
  await handle.close();
  const close = async () => {
    if ((await readJson(lockPath))?.token === token) await fs.unlink(lockPath);
  };
  const state = { networkRequests: 0, cachedSitemaps: [], freshSitemaps: [], stopped: false };
  let lastRequestAt = -Infinity, chain = Promise.resolve(), release = null;
  try {
    const cooldown = await readJson(cooldownPath);
    if (cooldown?.until > now()) throw new Error(`Monitoring cooldown until ${new Date(cooldown.until).toISOString()}; no requests sent.`);
  } catch (error) { await close(); throw error; }
  const stop = async () => {
    state.stopped = true;
    await fs.writeFile(cooldownPath, JSON.stringify({ until: now() + cooldownMs }));
  };
  async function request(input, options = {}) {
    const url = new URL(input);
    const internal = url.hostname.replace(/^www\./, "") === origin.hostname.replace(/^www\./, "");
    if (state.stopped) throw new Error("Monitoring stopped after an availability failure; no further requests sent.");
    const sitemap = internal && !url.search && /^\/(sitemap\.xml|sitemaps\/.+\.xml)$/.test(url.pathname);
    const cachePath = path.join(folder, `${hash(url.href)}.json`);
    // Always recheck the index and its release before reusing any leaf evidence.
    if (sitemap && url.pathname !== "/sitemap.xml" && release) {
      const cached = await readJson(cachePath);
      if (cached?.release === release && now() - cached.at >= 0 && now() - cached.at < cacheMs) {
        state.cachedSitemaps.push({ url: url.href, checkedAt: new Date(cached.at).toISOString() });
        const response = new Response(cached.body, { status: 200, headers: {
          "content-type": "application/xml", "x-ais-release": release,
          "x-ais-monitor-cached-at": new Date(cached.at).toISOString(),
        } });
        Object.defineProperty(response, "url", { value: url.href });
        return response;
      }
    }
    const wait = intervalMs - (now() - lastRequestAt);
    if (wait > 0) await sleep(wait);
    lastRequestAt = now();
    state.networkRequests++;
    let response;
    try {
      response = await fetchImpl(input, options);
      if (internal && transient(response.status)) await stop();
      if (sitemap && response.status === 200) {
        release = response.headers.get("x-ais-release") || release;
        state.freshSitemaps.push(url.href);
        const body = await response.clone().text();
        if (release && Buffer.byteLength(body) <= 65536 && /xml/.test(response.headers.get("content-type") || "") &&
            !/<!DOCTYPE|<!ENTITY/i.test(body) && XMLValidator.validate(body) === true) {
          const temporary = `${cachePath}.${token}.tmp`;
          await fs.writeFile(temporary, JSON.stringify({ release, at: now(), body }));
          await fs.rename(temporary, cachePath);
        }
      }
    } catch (error) {
      if (internal) await stop();
      throw error;
    }
    return response;
  }
  return { state, close, stop, fetch: (input, options) => {
    const pending = chain.then(() => request(input, options));
    chain = pending.catch(() => {});
    return pending;
  } };
}
