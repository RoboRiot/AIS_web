"use client";

import { useEffect, useState } from "react";
import { retryRecaptcha, subscribeRecaptchaStatus } from "@/components/utils/recaptcha";
import styles from "./RecaptchaStatus.module.scss";
import { BUSINESS_PHONE, BUSINESS_PHONE_HREF } from "@/app/data/businessContact.mjs";

export default function RecaptchaStatus() {
  const [status, setStatus] = useState("idle");
  const [retrying, setRetrying] = useState(false);
  useEffect(() => subscribeRecaptchaStatus(setStatus), []);

  const retry = async () => {
    setRetrying(true);
    try {
      await retryRecaptcha(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY);
    } finally {
      setRetrying(false);
    }
  };

  if (status === "local-preview") return (
    <aside className={`${styles.notice} ${styles.preview}`} role="status">
      <p>Local preview: sending is disabled. Google&apos;s production security key does not allow localhost.</p>
      <a href="https://advancedimagingparts.com/contact">Open the live contact form</a>
    </aside>
  );
  if (!["error", "retrying", "retry-ready"].includes(status)) return null;
  const checking = retrying || status === "retrying";
  return (
    <aside className={styles.notice} role="status" aria-live="polite">
      <div>
        <p>{status === "error"
          ? "The form security check could not connect. Your form entries are still here."
          : status === "retrying"
            ? "Restarting the security check. Your form entries are still here."
            : "The security check has reloaded. Try submitting your request again."}</p>
        <button type="button" onClick={retry} disabled={checking}>
          {checking ? "Retrying..." : "Retry security check"}
        </button>
        <span>Need help? <a href={BUSINESS_PHONE_HREF}>Call {BUSINESS_PHONE}</a>.</span>
      </div>
    </aside>
  );
}
