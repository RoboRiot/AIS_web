let scriptPromise = null;

export const ensureRecaptchaScript = (siteKey) => {
  if (!siteKey || typeof window === "undefined") {
    return Promise.resolve(false);
  }

  if (window.grecaptcha) {
    return Promise.resolve(true);
  }

  if (scriptPromise) {
    return scriptPromise;
  }

  scriptPromise = new Promise((resolve) => {
    const existing = document.getElementById("recaptcha-v3");
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      return;
    }

    const script = document.createElement("script");
    script.id = "recaptcha-v3";
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });

  return scriptPromise;
};

export const executeRecaptcha = async (siteKey, action) => {
  const loaded = await ensureRecaptchaScript(siteKey);
  if (!loaded || typeof window === "undefined" || !window.grecaptcha) {
    return null;
  }

  return new Promise((resolve) => {
    window.grecaptcha.ready(() => {
      window.grecaptcha
        .execute(siteKey, { action })
        .then(resolve)
        .catch(() => resolve(null));
    });
  });
};
