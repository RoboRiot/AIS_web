"use client";

import { useEffect, useState } from "react";
import { retryRecaptcha, subscribeRecaptchaStatus } from "@/components/utils/recaptcha";
import styles from "./RecaptchaStatus.module.scss";

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

  if (status !== "error" && status !== "retrying") return null;
  return (
    <aside className={styles.notice} role="status" aria-live="polite">
      <div>
        <p>{status === "error"
          ? "The form security check could not connect. Your form entries are still here."
          : "The security check has restarted. Try submitting your request again."}</p>
        <button type="button" onClick={retry} disabled={retrying}>
          {retrying ? "Retrying..." : "Retry security check"}
        </button>
        <span>Need help? <a href="tel:+15595376851">Call (559) 537-6851</a>.</span>
      </div>
    </aside>
  );
}
