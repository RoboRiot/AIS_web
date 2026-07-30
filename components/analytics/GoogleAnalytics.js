"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { shouldCollectBrowserAnalytics } from "@/app/data/analyticsPolicy.mjs";

const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-L0236JT5N3";

export default function GoogleAnalytics() {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (navigator.doNotTrack === "1") {
      setEnabled(false);
      return;
    }
    setEnabled(
      shouldCollectBrowserAnalytics({
        hostname: window.location.hostname,
        userAgent: navigator.userAgent,
        webdriver: navigator.webdriver,
      })
    );
  }, []);

  useEffect(() => {
    if (!enabled || !ready || typeof window.gtag !== "function") return;
    window.gtag("event", "page_view", {
      page_path: `${window.location.pathname}${window.location.search}`,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [enabled, pathname, ready]);

  if (!measurementId || !enabled) return null;
  return (
    <Script
      src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
      strategy="afterInteractive"
      onReady={() => {
        window.dataLayer = window.dataLayer || [];
        window.gtag =
          window.gtag ||
          function gtag() {
            window.dataLayer.push(arguments);
          };
        window.gtag("js", new Date());
        window.gtag("config", measurementId, {
          anonymize_ip: true,
          send_page_view: false,
        });
        setReady(true);
      }}
    />
  );
}
