"use client";

import { useEffect, useState } from "react";
import { browserMeasurementConsent, saveMeasurementConsent, MARKETING_CONSENT_EVENT } from "@/app/data/marketingConsent.mjs";
import { ATTRIBUTION_HISTORY_KEY } from "@/app/data/attributionHistory.mjs";
import { refreshMarketingAttribution } from "@/components/utils/analytics";
import styles from "./marketingPreferences.module.scss";

export default function MarketingPreferences() {
  const [status, setStatus] = useState({ advertising: "unknown", analytics: "unknown" });
  const [advertising, setAdvertising] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [open, setOpen] = useState(false);
  const [restricted, setRestricted] = useState(false);
  useEffect(() => {
    let storage;
    try { storage = window.localStorage; } catch { /* Private browsing may deny access. */ }
    const choice = browserMeasurementConsent(window);
    if (choice.advertising !== "granted") {
      try { storage?.removeItem(ATTRIBUTION_HISTORY_KEY); } catch { /* Storage is optional. */ }
    }
    setStatus(choice);
    setAdvertising(choice.advertising === "granted");
    setAnalytics(choice.analytics === "granted");
    setRestricted(navigator.doNotTrack === "1" || navigator.globalPrivacyControl === true);
    setOpen(choice.advertising === "unknown" || choice.analytics === "unknown");
  }, []);

  const choose = (next) => {
    saveMeasurementConsent(window, next);
    try {
      if (next.advertising !== "granted") localStorage.removeItem(ATTRIBUTION_HISTORY_KEY);
    } catch { /* Consent must not interrupt browsing. */ }
    const applied = browserMeasurementConsent(window);
    setStatus(applied);
    setAdvertising(applied.advertising === "granted");
    setAnalytics(applied.analytics === "granted");
    setOpen(false);
    window.dispatchEvent(new Event(MARKETING_CONSENT_EVENT));
    refreshMarketingAttribution();
  };

  return <div className={styles.preferences}>
    <button type="button" data-analytics-ignore="true" onClick={() => setOpen(true)} aria-expanded={open}>Marketing privacy</button>
    {open && <section className={styles.panel} aria-label="Marketing measurement preferences">
      <div>
        <h2>Measurement preferences</h2>
        <p>Choose optional measurement. Forms and service work regardless of your choice. No personalized advertising.</p>
        <label className={styles.option}>
          <input type="checkbox" checked={analytics} disabled={restricted} onChange={(event) => setAnalytics(event.target.checked)} />
          <span>Google Analytics cookies to understand visits and website use.</span>
        </label>
        <label className={styles.option}>
          <input type="checkbox" checked={advertising} disabled={restricted} onChange={(event) => setAdvertising(event.target.checked)} />
          <span>Advertising measurement, including Google call tracking and remembering referral visits for up to 30 days.</span>
        </label>
        {restricted && <p>Your browser privacy signal disables this measurement.</p>}
      </div>
      <div className={styles.actions}>
        <button type="button" data-analytics-ignore="true" onClick={() => choose({ advertising: "denied", analytics: "denied" })}>Decline all</button>
        {!restricted && <button type="button" data-analytics-ignore="true" className={styles.accept}
          onClick={() => choose({ advertising: advertising ? "granted" : "denied", analytics: analytics ? "granted" : "denied" })}>Save choices</button>}
        {status.advertising !== "unknown" && status.analytics !== "unknown" && <button type="button" data-analytics-ignore="true" onClick={() => setOpen(false)}>Close</button>}
      </div>
    </section>}
  </div>;
}
