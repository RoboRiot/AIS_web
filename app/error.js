"use client";

import { useEffect } from "react";
import { recoverFromClientError } from "@/components/errors/ClientRouteRecovery";

export default function RouteError({ error, reset }) {
  useEffect(() => {
    console.error(error);
    recoverFromClientError(error);
  }, [error]);

  return (
    <section
      role="alert"
      style={{
        maxWidth: "720px",
        margin: "80px auto",
        padding: "32px",
        textAlign: "center",
      }}
    >
      <h1>We could not finish loading this page.</h1>
      <p>Please try again. Your search and catalog data are still safe.</p>
      <button type="button" className="simple-btn" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
