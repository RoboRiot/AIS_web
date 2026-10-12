import { shouldCollectBrowserAnalytics } from "./analyticsPolicy.mjs";

const RETRY_DELAYS = [1000, 5000];

// Retry the same Google URL after an actual load error, never proxy a blocked tag
// or replay conversions. The existing dataLayer remains the single event queue.
export function startGoogleTagLoader(browser, document, measurementId, onStatus = () => {}) {
  if (browser.__aisGoogleTagLoader) return browser.__aisGoogleTagLoader;
  const eligible = () => browser.navigator?.doNotTrack !== "1" &&
    browser.navigator?.globalPrivacyControl !== true && shouldCollectBrowserAnalytics({
      hostname: browser.location.hostname, userAgent: browser.navigator?.userAgent,
      webdriver: browser.navigator?.webdriver,
    });
  if (!eligible() || !/^G-[A-Z0-9]+$/i.test(measurementId)) return null;
  let attempts = 0, script = null, retryTimer = null, slowTimer = null;
  let stopped = false, cspBlocked = false;
  const report = (state, reason = "none") => {
    browser.__aisGoogleTagState = state;
    browser.__aisGoogleTagDiagnostics = { tagLoadAttempts: attempts, tagLoadError: reason };
    try { onStatus({ tag_state: state, tag_load_attempts: attempts, tag_load_error: reason }); }
    catch { /* Optional diagnostics must not affect tag loading. */ }
  };
  const clearTimers = () => {
    browser.clearTimeout(retryTimer);
    browser.clearTimeout(slowTimer);
    retryTimer = slowTimer = null;
  };
  const detach = () => {
    browser.removeEventListener("online", onOnline);
    document.removeEventListener("securitypolicyviolation", onCsp);
  };
  const stop = () => {
    stopped = true;
    clearTimers();
    detach();
  };
  const load = () => {
    if (stopped || cspBlocked || attempts >= 3) return;
    if (!eligible()) { stop(); return; }
    if (browser.navigator.onLine === false) { report("queued", "offline"); return; }
    clearTimers();
    script?.remove();
    attempts++;
    report("queued");
    const current = document.createElement("script");
    script = current;
    current.async = true;
    current.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    current.onload = () => {
      if (stopped || script !== current) return;
      report("loaded");
      stop();
    };
    current.onerror = () => {
      if (stopped || script !== current) return;
      clearTimers();
      script = null;
      current.remove();
      report("failed", cspBlocked ? "csp_blocked" : browser.navigator.onLine === false ? "offline" : "script_error");
      if (cspBlocked || attempts >= 3) { stop(); return; }
      if (browser.navigator.onLine !== false) retryTimer = browser.setTimeout(load, RETRY_DELAYS[attempts - 1]);
    };
    // A slow request may still execute. Observe it, but never launch a concurrent copy.
    slowTimer = browser.setTimeout(() => {
      if (!stopped && script === current) report("queued", "load_timeout");
    }, 15000);
    try { document.head.appendChild(current); } catch { current.onerror(); }
  };
  function onOnline() {
    if (!script && !stopped) load();
  }
  function onCsp(event) {
    if (event.disposition !== "enforce" || !String(event.effectiveDirective).startsWith("script-src")) return;
    let url;
    try { url = new URL(event.blockedURI); } catch { return; }
    if (url.origin !== "https://www.googletagmanager.com" || !["/", "/gtag/js"].includes(url.pathname)) return;
    cspBlocked = true;
    report("failed", "csp_blocked");
    stop();
  }
  const controller = { stop };
  browser.__aisGoogleTagLoader = controller;
  browser.addEventListener("online", onOnline);
  document.addEventListener("securitypolicyviolation", onCsp);
  load();
  return controller;
}
