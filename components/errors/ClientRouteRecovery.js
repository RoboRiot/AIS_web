"use client";

import { useEffect } from "react";

const RECOVERY_PARAM = "__ais_recover";
const RECOVERY_KEY_PREFIX = "ais-route-recovery:";
const RECOVERY_WINDOW_MS = 5 * 60 * 1000;

const getErrorMessage = (value) => {
  if (typeof value === "string") return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  return value?.message || value?.reason?.message || "";
};

const isRecoverableClientFailure = (value) => {
  const message = getErrorMessage(value);
  return /ChunkLoadError|Loading chunk \d+ failed|Failed to fetch dynamically imported module|Failed to fetch RSC payload|Cannot read properties of null \(reading ['"]includes['"]\)/i.test(
    message,
  );
};

const recoverCurrentRoute = () => {
  try {
    const recoveryKey = `${RECOVERY_KEY_PREFIX}${window.location.pathname}`;
    const lastRecovery = Number(sessionStorage.getItem(recoveryKey) || 0);
    if (Date.now() - lastRecovery < RECOVERY_WINDOW_MS) return;

    sessionStorage.setItem(recoveryKey, String(Date.now()));
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set(RECOVERY_PARAM, String(Date.now()));
    window.location.replace(nextUrl.toString());
  } catch {
    window.location.reload();
  }
};

export const recoverFromClientError = (error) => {
  if (isRecoverableClientFailure(error)) recoverCurrentRoute();
};

export default function ClientRouteRecovery() {
  useEffect(() => {
    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.has(RECOVERY_PARAM)) {
      currentUrl.searchParams.delete(RECOVERY_PARAM);
      window.history.replaceState(window.history.state, "", currentUrl.toString());
    }

    const handleWindowError = (event) => {
      const failedElement = event.target;
      const failedAsset =
        failedElement instanceof HTMLScriptElement ||
        failedElement instanceof HTMLLinkElement
          ? failedElement.src || failedElement.href
          : "";

      if (failedAsset.includes("/_next/static/")) {
        recoverCurrentRoute();
        return;
      }

      recoverFromClientError(event.error || event.message);
    };

    const handleUnhandledRejection = (event) => {
      recoverFromClientError(event.reason);
    };

    window.addEventListener("error", handleWindowError, true);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleWindowError, true);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}
