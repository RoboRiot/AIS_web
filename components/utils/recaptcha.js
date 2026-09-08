let scriptPromise = null;
const TIMEOUT_MS = 15_000;

export const ensureRecaptchaScript = (siteKey) => {
  if (!siteKey || typeof window === "undefined") {
    return Promise.resolve(false);
  }

  if (typeof window.grecaptcha?.execute === "function") {
    return Promise.resolve(true);
  }

  if (scriptPromise) {
    return scriptPromise;
  }

  scriptPromise = new Promise((resolve) => {
    const existing = document.getElementById("recaptcha-v3");
    const script = existing || document.createElement("script");
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      script.removeEventListener("load", loaded);
      script.removeEventListener("error", failed);
      if (!ok) script.remove();
      resolve(ok);
    };
    const loaded = () => finish(typeof window.grecaptcha?.execute === "function");
    const failed = () => finish(false);
    const timeout = window.setTimeout(failed, TIMEOUT_MS);
    script.addEventListener("load", loaded, { once: true });
    script.addEventListener("error", failed, { once: true });
    if (!existing) {
      script.id = "recaptcha-v3";
      script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
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
