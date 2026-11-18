import assert from "node:assert/strict";

export async function verificationRequest(url, options = {}) {
  const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(45000),
    headers: { "User-Agent": "AIS-Website-Health-Monitor/2.0" }, ...options });
  const release = response.headers.get("x-ais-release");
  // Next config redirects can run before custom headers. Their destinations
  // must still pass the exact-release check; never accept unlabeled page bodies.
  const earlyRedirect = response.status >= 300 && response.status < 400 && response.headers.has("location");
  if (process.env.AIS_EXPECTED_RELEASE && (release || !earlyRedirect)) assert.equal(release, process.env.AIS_EXPECTED_RELEASE, `${url}: wrong or missing release header`);
  return response;
}
