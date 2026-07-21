"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackWebsiteEvent } from "@/components/utils/analytics";

const labelFor = (element) =>
  (element.dataset.analyticsLabel ||
    element.getAttribute("aria-label") ||
    element.getAttribute("title") ||
    element.textContent ||
    element.tagName)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);

const destinationFor = (element) => {
  const href = element.getAttribute("href");
  if (!href) return "";
  try {
    const url = new URL(href, window.location.origin);
    return url.origin === window.location.origin ? url.pathname : url.hostname;
  } catch {
    return "";
  }
};

export default function WebsiteAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    trackWebsiteEvent("page_view", { page_path: pathname || "/" });
  }, [pathname]);

  useEffect(() => {
    const startedForms = new WeakSet();
    const onClick = (event) => {
      const element = event.target.closest?.("a, button, [data-analytics]");
      if (!element || element.dataset.analyticsIgnore === "true") return;
      trackWebsiteEvent("click", {
        element: element.dataset.analytics || element.tagName.toLowerCase(),
        label: labelFor(element),
        destination: destinationFor(element),
      });
    };
    const onFocus = (event) => {
      const form = event.target.closest?.("form");
      if (!form || startedForms.has(form)) return;
      startedForms.add(form);
      trackWebsiteEvent("form_start", {
        form_type: form.dataset.formType || form.getAttribute("name") || "unknown",
      });
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("focusin", onFocus, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("focusin", onFocus, true);
    };
  }, []);

  return null;
}
