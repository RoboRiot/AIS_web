"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { MARKETING_CONSENT_EVENT, MARKETING_CONSENT_KEY, synchronizeGoogleConsent } from "@/app/data/marketingConsent.mjs";
import { createGtmPhoneNumberBridge, WEBSITE_CALL_GTM_EVENT } from "@/app/data/websiteCallTracking.mjs";

export default function WebsiteCallTracking({ enabled }) {
  const pathname = usePathname();
  const lastRequestedPath = useRef(null);
  useEffect(() => {
    if (!enabled) return;
    const bridge = createGtmPhoneNumberBridge(document);
    let allowed = false;
    const synchronize = () => {
      const state = synchronizeGoogleConsent(window);
      const next = state.ad_storage === "granted" && state.ad_user_data === "granted";
      bridge.synchronize(next);
      if (next && !allowed) {
        window.dataLayer.push({ event: WEBSITE_CALL_GTM_EVENT });
        lastRequestedPath.current = window.location.pathname;
      }
      if (!next) lastRequestedPath.current = null;
      allowed = next;
    };
    const storageChanged = (event) => {
      if (event.key && event.key !== MARKETING_CONSENT_KEY) return;
      delete window.__aisConsentChoice;
      synchronize();
    };
    const observer = new MutationObserver(() => bridge.synchronize(allowed));
    observer.observe(document.body, { childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ["href"] });
    synchronize();
    window.addEventListener(MARKETING_CONSENT_EVENT, synchronize);
    window.addEventListener("storage", storageChanged);
    return () => {
      observer.disconnect();
      window.removeEventListener(MARKETING_CONSENT_EVENT, synchronize);
      window.removeEventListener("storage", storageChanged);
    };
  }, [enabled]);
  useEffect(() => {
    if (!enabled || lastRequestedPath.current === pathname) return;
    const state = synchronizeGoogleConsent(window);
    if (state.ad_storage !== "granted" || state.ad_user_data !== "granted") return;
    window.dataLayer.push({ event: WEBSITE_CALL_GTM_EVENT });
    lastRequestedPath.current = pathname;
  }, [enabled, pathname]);
  return null;
}
