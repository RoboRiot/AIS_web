"use client";

import { useEffect } from "react";
import { marketingConsent, MARKETING_CONSENT_EVENT } from "@/app/data/marketingConsent.mjs";
import { BUSINESS_PHONE, WEBSITE_CALL_DESTINATION, createPhoneNumberReplacement, normalizeForwardingNumber } from "@/app/data/websiteCallTracking.mjs";

export default function WebsiteCallTracking({ enabled }) {
  useEffect(() => {
    if (!enabled || typeof window.gtag !== "function") return;
    const replacement = createPhoneNumberReplacement(document);
    let number = null;
    let allowed = false;
    let generation = 0;
    const observer = new MutationObserver(() => {
      if (allowed && number) replacement.apply(number);
    });
    const synchronize = () => {
      let storage;
      try { storage = window.localStorage; } catch { /* No consent without storage. */ }
      const next = marketingConsent({ storage, navigator }) === "granted";
      window.gtag("consent", "update", {
        ad_storage: next ? "granted" : "denied",
        ad_user_data: next ? "granted" : "denied",
        ad_personalization: "denied",
      });
      if (!next) {
        generation++;
        allowed = false;
        number = null;
        observer.disconnect();
        replacement.restore();
        return;
      }
      if (allowed) return;
      const token = ++generation;
      allowed = true;
      observer.observe(document.body, { childList: true, subtree: true });
      window.gtag("config", WEBSITE_CALL_DESTINATION.split("/")[0], {
        send_page_view: false, allow_ad_personalization_signals: false,
      });
      window.gtag("config", WEBSITE_CALL_DESTINATION, {
        phone_conversion_number: BUSINESS_PHONE,
        phone_conversion_options: { timeout: 5000, cache: false },
        phone_conversion_callback: (formatted, dialable) => {
          if (!allowed || token !== generation) return;
          number = normalizeForwardingNumber(formatted, dialable);
          if (number) replacement.apply(number);
        },
      });
    };
    synchronize();
    window.addEventListener(MARKETING_CONSENT_EVENT, synchronize);
    window.addEventListener("storage", synchronize);
    return () => {
      allowed = false;
      generation++;
      observer.disconnect();
      replacement.restore();
      window.removeEventListener(MARKETING_CONSENT_EVENT, synchronize);
      window.removeEventListener("storage", synchronize);
    };
  }, [enabled]);
  return null;
}
