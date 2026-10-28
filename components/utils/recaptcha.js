let scriptPromise = null;
const TIMEOUT_MS = 15_000;
const HOST_ID = "ais-recaptcha-host";
const FRAME_SELECTOR = 'iframe[src*="/recaptcha/"]';
let widgetId = null;
let widgetKey = null;
let widgetFailed = false;
let widgetMount = null;
let widgetGeneration = 0;
let widgetObserver = null;
let widgetTimer = null;
let recoveryPromise = null;
let status = "idle";
const listeners = new Set();
const widgetWaiters = new Set();

export const isLocalFormPreview = () => typeof window !== "undefined" &&
  /^(?:localhost|127\.0\.0\.1|\[?::1\]?|.+\.localhost)$/i.test(window.location?.hostname || "");

const setStatus = (next) => {
  if (status === next) return;
  status = next;
  listeners.forEach((listener) => listener(next));
};

const hasWidgetFrame = () => Boolean(
  widgetMount?.isConnected && widgetMount.querySelector(FRAME_SELECTOR),
);

const notifyWidgetWaiters = () => [...widgetWaiters].forEach((check) => check());
const markWidgetFailed = () => {
  widgetFailed = true;
  setStatus("error");
  notifyWidgetWaiters();
};

const watchWidget = (host, generation) => {
  let sawFrame = hasWidgetFrame();
  const inspect = () => {
    if (generation !== widgetGeneration) return;
    if (hasWidgetFrame()) {
      sawFrame = true;
      window.clearTimeout(widgetTimer);
      widgetTimer = null;
    } else if (widgetTimer === null) {
      // A Google bootstrap failure can replace the iframe with text without
      // invoking error-callback. Observe structure, not localized error wording.
      widgetTimer = window.setTimeout(() => {
        widgetTimer = null;
        if (generation === widgetGeneration && !hasWidgetFrame()) markWidgetFailed();
      }, sawFrame ? 250 : TIMEOUT_MS);
    }
    notifyWidgetWaiters();
  };
  if (typeof window.MutationObserver === "function") {
    widgetObserver = new window.MutationObserver(inspect);
    widgetObserver.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
  }
  inspect();
};

const waitForWidgetFrame = (generation) => new Promise((resolve) => {
  let timeout;
  const finish = (ok) => {
    window.clearTimeout(timeout);
    widgetWaiters.delete(check);
    resolve(ok);
  };
  const check = () => {
    if (generation !== widgetGeneration || widgetFailed) finish(false);
    else if (hasWidgetFrame()) finish(true);
  };
  timeout = window.setTimeout(() => {
    if (generation === widgetGeneration && !widgetFailed && hasWidgetFrame()) return finish(true);
    if (generation === widgetGeneration) markWidgetFailed();
    finish(false);
  }, TIMEOUT_MS);
  widgetWaiters.add(check);
  check();
});

export const subscribeRecaptchaStatus = (listener) => {
  listeners.add(listener);
  listener(status);
  return () => listeners.delete(listener);
};

const renderWidget = (siteKey, replace = false) => {
  if (widgetId !== null && !replace) return widgetKey === siteKey;
  const host = document.getElementById(HOST_ID);
  if (!host || typeof window.grecaptcha?.render !== "function") return false;
  const oldId = widgetId;
  const generation = ++widgetGeneration;
  widgetObserver?.disconnect();
  window.clearTimeout(widgetTimer);
  widgetTimer = null;
  widgetId = null;
  notifyWidgetWaiters();
  if (replace && oldId !== null) {
    // A removed iframe cannot be recovered reliably by reset alone. Retire the
    // old client best-effort, then render into a fresh, isolated child mount.
    try { window.grecaptcha.reset(oldId); } catch { /* The old frame may be gone. */ }
  }
  widgetMount = document.createElement("div");
  host.replaceChildren(widgetMount);
  widgetFailed = false;
  const id = window.grecaptcha.render(widgetMount, {
    sitekey: siteKey,
    size: "invisible",
    badge: "bottomright",
    "error-callback": () => {
      if (generation === widgetGeneration) markWidgetFailed();
    },
  });
  if (typeof id !== "number") return false;
  widgetId = id;
  widgetKey = siteKey;
  watchWidget(host, generation);
  return true;
};

export const ensureRecaptchaScript = (siteKey) => {
  // Never send local previews through the production key or create real leads.
  if (isLocalFormPreview()) {
    setStatus("local-preview");
    return Promise.resolve(false);
  }
  if (!siteKey || typeof window === "undefined") {
    return Promise.resolve(false);
  }

  if (scriptPromise) {
    return scriptPromise;
  }

  scriptPromise = new Promise((resolve) => {
    const existing = document.getElementById("recaptcha-v3");
    const script = existing || document.createElement("script");
    let settled = false;
    let loaded = existing?.dataset.recaptchaLoaded === "true";
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", failed);
      resolve(ok);
    };
    const waitForReady = () => {
      try {
        if (typeof window.grecaptcha?.ready !== "function") return finish(false);
        window.grecaptcha.ready(() => {
          if (settled) return;
          try {
            finish(typeof window.grecaptcha?.execute === "function" && renderWidget(siteKey));
          } catch {
            finish(false);
          }
        });
      } catch {
        finish(false);
      }
    };
    const onLoad = () => {
      loaded = true;
      script.dataset.recaptchaLoaded = "true";
      // api.js loads a second script asynchronously; its load event is not API readiness.
      waitForReady();
    };
    const failed = () => {
      script.remove();
      finish(false);
    };
    const timeout = window.setTimeout(() => {
      // Do not reinsert a bootstrap that already ran while Google's ready queue
      // is pending. A later user retry can wait on that same API without duplication.
      if (!loaded && typeof window.grecaptcha?.ready !== "function") script.remove();
      finish(false);
    }, TIMEOUT_MS);
    if (typeof window.grecaptcha?.ready === "function" || loaded) {
      waitForReady();
      return;
    }
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", failed, { once: true });
    if (!existing) {
      script.id = "recaptcha-v3";
      // Google's supported alternate domain avoids www.google.com restrictions.
      script.src = "https://www.recaptcha.net/recaptcha/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      try {
        document.head.appendChild(script);
      } catch {
        failed();
      }
    }
  }).then((ok) => {
    if (!ok) {
      scriptPromise = null;
      setStatus("error");
    }
    return ok;
  });

  return scriptPromise;
};

export const retryRecaptcha = (siteKey) => {
  if (!siteKey || (widgetKey && widgetKey !== siteKey)) return Promise.resolve(false);
  if (recoveryPromise) return recoveryPromise;
  recoveryPromise = (async () => {
    try {
      setStatus("retrying");
      if (!(await ensureRecaptchaScript(siteKey)) || widgetKey !== siteKey) return false;
      widgetFailed = false;
      if (!hasWidgetFrame()) {
        if (!renderWidget(siteKey, true)) throw new Error("Widget unavailable");
      } else {
        window.grecaptcha.reset(widgetId);
      }
      const restored = await waitForWidgetFrame(widgetGeneration);
      if (restored) setStatus("retry-ready");
      return restored;
    } catch {
      markWidgetFailed();
      return false;
    }
  })().finally(() => { recoveryPromise = null; });
  return recoveryPromise;
};

export const executeRecaptcha = async (siteKey, action) => {
  const loaded = await ensureRecaptchaScript(siteKey);
  if (!loaded || typeof window === "undefined" || !window.grecaptcha || widgetKey !== siteKey) {
    return null;
  }
  if ((widgetFailed || !hasWidgetFrame()) && !(await retryRecaptcha(siteKey))) return null;
  const generation = widgetGeneration;
  const clientId = widgetId;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (token) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      if (generation !== widgetGeneration) return resolve(null);
      widgetFailed = !token;
      setStatus(token ? "idle" : "error");
      resolve(token || null);
    };
    const timeout = window.setTimeout(() => finish(null), TIMEOUT_MS);
    try {
      window.grecaptcha.ready(() => {
        if (settled || generation !== widgetGeneration) return finish(null);
        try {
          window.grecaptcha.execute(clientId, { action }).then(finish).catch(() => finish(null));
        } catch {
          finish(null);
        }
      });
    } catch {
      finish(null);
    }
  });
};
