"use client";

import { useEffect } from "react";
import { trackWebsiteEvent } from "@/components/utils/analytics";

const referrerPath = () => {
  try {
    const url = new URL(document.referrer);
    return url.origin === window.location.origin ? url.pathname.slice(0, 300) : "external";
  } catch {
    return "direct";
  }
};

export default function NotFoundAnalytics() {
  useEffect(() => {
    trackWebsiteEvent("page_not_found", {
      not_found_path: window.location.pathname.slice(0, 300),
      referrer_path: referrerPath(),
    });
  }, []);

  return null;
}
