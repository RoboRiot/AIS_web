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
    const openedForms = new WeakSet();
    const observedForms = new WeakSet();
    const formObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const form = entry.target;
          const formType = form.dataset.formType;
          if (!entry.isIntersecting || !formType || openedForms.has(form)) return;
          openedForms.add(form);
          formObserver.unobserve(form);
          trackWebsiteEvent("form_open", {
            form_type: formType,
            source: form.dataset.formSource || "embedded_form",
          });
        });
      },
      { threshold: 0.2 }
    );
    const observeForms = (root = document) => {
      const forms = root.matches?.("form[data-form-type]")
        ? [root]
        : [...(root.querySelectorAll?.("form[data-form-type]") || [])];
      forms.forEach((form) => {
        if (
          observedForms.has(form) ||
          form.dataset.formOpenTracking === "manual"
        ) {
          return;
        }
        observedForms.add(form);
        formObserver.observe(form);
      });
    };
    observeForms();
    const formMutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) observeForms(node);
        });
      });
    });
    formMutationObserver.observe(document.body, { childList: true, subtree: true });

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
      const formType = form?.dataset.formType;
      if (!formType || startedForms.has(form)) return;
      startedForms.add(form);
      trackWebsiteEvent("form_start", {
        form_type: formType,
      });
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("focusin", onFocus, true);
    return () => {
      formMutationObserver.disconnect();
      formObserver.disconnect();
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("focusin", onFocus, true);
    };
  }, []);

  return null;
}
