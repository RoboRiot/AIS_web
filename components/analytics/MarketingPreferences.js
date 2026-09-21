"use client";

import { useEffect, useState } from "react";
import { marketingConsent, MARKETING_CONSENT_KEY, MARKETING_CONSENT_EVENT } from "@/app/data/marketingConsent.mjs";
import { ATTRIBUTION_HISTORY_KEY } from "@/app/data/attributionHistory.mjs";
import { refreshMarketingAttribution } from "@/components/utils/analytics";
import styles from "./marketingPreferences.module.scss";

export default function MarketingPreferences() {
  const [status, setStatus] = useState("unknown");
  const [open, setOpen] = useState(false);
  const [restricted, setRestricted] = useState(false);
  useEffect(() => {
    let storage;
    try { storage = window.localStorage; } catch { /* Private browsing may deny access. */ }
    const choice = marketingConsent({ storage, navigator });
    if (choice !== "granted") {
      try { storage?.removeItem(ATTRIBUTION_HISTORY_KEY); } catch { /* Storage is optional. */ }
    }
    setStatus(choice);
    setRestricted(navigator.doNotTrack === "1" || navigator.globalPrivacyControl === true);
    setOpen(choice === "unknown");
  }, []);

  const choose = (next) => {
    try {
      localStorage.setItem(MARKETING_CONSENT_KEY, JSON.stringify({ status: next, at: Date.now() }));
      if (next !== "granted") localStorage.removeItem(ATTRIBUTION_HISTORY_KEY);
    } catch { /* Consent must not interrupt browsing. */ }
    setStatus(next);
    setOpen(false);
    refreshMarketingAttribution();
    window.dispatchEvent(new Event(MARKETING_CONSENT_EVENT));
  };

  return <div className={styles.preferences}>
    <button type="button" data-analytics-ignore="true" onClick={() => setOpen(true)} aria-expanded={open}>Marketing privacy</button>
    {open && <section className={styles.panel} aria-label="Marketing measurement preferences">
      <div>
        <h2>Marketing measurement</h2>
        <p>Allow us to remember visits in this browser for up to 30 days and use Google call measurement
          to understand which ads bring inquiries. Optional; your choice will not affect our forms or service.</p>
        {restricted && <p>Your browser privacy signal disables this measurement.</p>}
      </div>
      <div className={styles.actions}>
        <button type="button" data-analytics-ignore="true" onClick={() => choose("denied")}>Decline</button>
        {!restricted && <button type="button" data-analytics-ignore="true" className={styles.accept} onClick={() => choose("granted")}>Allow</button>}
        {status !== "unknown" && <button type="button" data-analytics-ignore="true" onClick={() => setOpen(false)}>Close</button>}
      </div>
    </section>}
  </div>;
}
