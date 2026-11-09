// Next 15 decodes Flight imports before checking the payload build ID. Reject
// requests from a different deployment before incompatible modules can decode.
export function guardRscDeployment(request, deploymentId, response) {
  const requestedDeployment = request.headers.get("x-deployment-id");
  // Next 15 removes the RSC header before middleware. Its client navigation
  // deployment header survives; Server Actions also send it, but use POST.
  if (
    !["GET", "HEAD"].includes(request.method) ||
    !requestedDeployment ||
    request.headers.get("sec-fetch-dest") === "document" ||
    request.headers.get("accept")?.toLowerCase().includes("text/html")
  ) return response;

  const hasDeploymentMismatch =
    typeof deploymentId === "string" &&
    deploymentId.length > 0 &&
    requestedDeployment &&
    requestedDeployment !== deploymentId;
  // A non-Flight, empty response makes Next perform a normal page navigation.
  // 204 avoids reporting an expected deployment transition as a failed request.
  const protectedResponse = hasDeploymentMismatch
    ? new Response(null, { status: 204 })
    : response;

  protectedResponse.headers.set("Cache-Control", "private, no-store, max-age=0");
  const vary = protectedResponse.headers.get("Vary");
  if (!vary?.split(",").some((value) => value.trim().toLowerCase() === "x-deployment-id")) {
    protectedResponse.headers.set("Vary", [vary, "x-deployment-id"].filter(Boolean).join(", "));
  }
  if (hasDeploymentMismatch) {
    protectedResponse.headers.set("X-AIS-Navigation-Reload", "deployment-mismatch");
  }
  return protectedResponse;
}
