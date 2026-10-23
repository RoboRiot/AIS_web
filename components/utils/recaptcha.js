let scriptPromise = null;
const TIMEOUT_MS = 15_000;

export const ensureRecaptchaScript = (siteKey) => {
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
          if (!settled) finish(typeof window.grecaptcha?.execute === "function");
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
      script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
      script.async = true;
      script.defer = true;
      try {
        document.head.appendChild(script);
      } catch {
        failed();
      }
    }
  }).then((ok) => {
    if (!ok) scriptPromise = null;
    return ok;
  });

  return scriptPromise;
};

export const executeRecaptcha = async (siteKey, action) => {
  const loaded = await ensureRecaptchaScript(siteKey);
  if (!loaded || typeof window === "undefined" || !window.grecaptcha) {
    return null;
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (token) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve(token || null);
    };
    const timeout = window.setTimeout(() => finish(null), TIMEOUT_MS);
    try {
      window.grecaptcha.ready(() => {
        if (settled) return;
        try {
          window.grecaptcha.execute(siteKey, { action }).then(finish).catch(() => finish(null));
        } catch {
          finish(null);
        }
      });
    } catch {
      finish(null);
    }
  });
};
