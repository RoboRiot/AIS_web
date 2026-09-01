"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createLeadId, trackWebsiteEvent } from "@/components/utils/analytics";

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

const communicationEventFor = (element) => {
  const href = String(element.getAttribute("href") || "").toLowerCase();
  if (href.startsWith("tel:")) return "phone_click";
  if (href.startsWith("mailto:")) return "email_click";
  return "";
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
        link_location: pathname || "/",
      });
      const communicationEvent = communicationEventFor(element);
      if (communicationEvent) {
        trackWebsiteEvent(communicationEvent, {
          label: labelFor(element),
          destination: destinationFor(element),
          link_location: element.dataset.analyticsSource || pathname || "/",
        });
      }
    };
    const onFocus = (event) => {
      const form = event.target.closest?.("form");
      const formType = form?.dataset.formType;
      if (!formType || startedForms.has(form)) return;
      startedForms.add(form);
      const leadId = form.dataset.leadId || createLeadId();
      form.dataset.leadId = leadId;
      trackWebsiteEvent("form_start", {
        form_type: formType,
        form_source: form.dataset.formSource || "",
        lead_id: leadId,
      });
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("focusin", onFocus, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("focusin", onFocus, true);
    };
  }, [pathname]);

  return null;
}
