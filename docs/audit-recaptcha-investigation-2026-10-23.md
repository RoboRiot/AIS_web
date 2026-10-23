# Asset audit and reCAPTCHA investigation - October 23, 2026

## Scope and release status

Fix the local audit false alarms and investigate the intermittent reCAPTCHA
warning. No Ads budgets/settings, GTM configuration, Voice settings, privacy/legal
text, server console, SSH, or remote execution changed. The user approved committing
and pushing these scoped fixes on October 23. Deployment remains a separate user
pull/build/restart step. At investigation time, the live website remained
`a10e75139ea6-mvl86hs1`.

## Audit false positives: confirmed and corrected

The old verifier searched every HTML byte, including Next.js flight payload
strings. A resource URL split across streaming script strings was mistaken for
a real destination, producing `/assets/images/bannerslid` and `/assets/i`.

The verifier now uses the existing Next-bundled HTML parser and extracts resource
attributes, responsive image candidates, inline CSS, and referenced stylesheets.
It does not search script bodies, JSON data, comments, or plain text for URLs.
It still reports those short paths if they actually appear in rendered resource
attributes, and still checks invalid image-optimizer URLs and genuine HTTP errors.

Fresh live run of `verify-site-assets.mjs` with concurrency 1 and 40 product pages:

- 81 pages and 997 same-origin resources checked.
- 0 page failures and 0 asset failures.
- 8,022 routes discovered in sitemaps; this is sampled coverage, not a full crawl.
- All checked pages report the same current live release.
- Historical audit files are retained rather than rewritten.

## reCAPTCHA: confirmed loader race, warning still needs live follow-up

The warning was reproduced on the live CT trailer page without submitting a form.
At that time the `recaptcha-v3` bootstrap element had been removed while Google's
gstatic secondary script remained. Reloading later produced a reCAPTCHA iframe
and no warning, despite the bootstrap element again being absent.

The code treated api.js's load event as full API readiness. Google's bootstrap
sets up a ready queue and asynchronously loads a second script; `execute` can
therefore be absent when the first load event fires. The old handler immediately
resolved failure and removed the bootstrap, allowing a subsequent request to
insert it again while the original secondary script was still pending.

The local repair waits for `grecaptcha.ready`, shares pending initialization,
retains a successfully loaded bootstrap during a readiness timeout, and allows
retry after a genuine bootstrap load failure. Expired token-request callbacks
cannot start execution later. No verification is bypassed; failed checks still
block submission. Trailer/service forms now classify client verification failures
as `recaptcha_token` and display a reload/call fallback.

The live CSP permits Google's documented script, frame and connection origins.
No CSP, key, quota, Google account, browser-extension, or VPN setting was changed.
Browser logs did not identify a reCAPTCHA-specific network/CSP error; later logs
included generic extension-message channel errors. Their cause is not established.
The confirmed loader bug is not proof of the warning's only possible cause.

Read-only first-party diagnostics for October 9-23 UTC (October 23 partial)
returned no recorded form_error events. That does not establish that every visitor
could submit, and accepted submissions are not necessarily qualified leads.

## Verification

- 130 unit tests passed, including 11 new audit/loading regression tests.
- Lint and isolated production build `audit-recaptcha-20261023` passed; existing
  Sass/Node deprecation warnings remain.
- Regression fixtures cover delayed readiness, shared initialization, network
  failure, retry, readiness timeout, late callbacks, absent key/browser, blocked
  script insertion, real missing resources and Next stream fragments.
- Tests use synthetic local tokens only. No production token execution, test
  calls, paid-ad clicks or synthetic lead submissions performed.

Release handoff: commit/push the approved fixes, user pull/build/restart, then verify bootstrap
retention and direct/internal-navigation behavior in the deployed build. Confirm
real submission delivery only from a genuine inquiry or separately authorized
controlled test; page loading alone is insufficient.

## Official references

- https://developers.google.com/recaptcha/docs/loading
- https://developers.google.com/recaptcha/docs/faq

Google recommends asynchronous loading with readiness coordination, and documents
the permitted CSP origins. The initial bootstrap response was also inspected
read-only to confirm its secondary-script loading sequence.

## Follow-up: late widget connection failure and local recovery repair

The user deployed `f2658c57d4fd-mvla7pu5`. Public/browser checks confirmed that the
bootstrap now stays loaded, but the Google widget can still replace its iframe
with "Could not connect to the reCAPTCHA service" after initially rendering.
This was reproduced around navigation from CT trailer to CT service and from
service request to MRI trailer. A fresh reload restored the iframe temporarily.
Google's own demo remained available in the same browser. These observations do
not prove that navigation causes the failure or identify the network/extension/
Google-side cause. No CAPTCHA was solved and no live form was submitted.

The remaining confirmed application gap was caching API readiness with no widget
error callback and no recovery except a full reload. This follow-up changes the
shared loader to Google's documented explicit v3 rendering API:

- One stable root-layout host; reuse its returned client ID across form mounts.
- Catch late widget errors and show a scoped notice inside each inquiry form.
- Offer a user-requested reset of that client without clearing entered fields,
  reinserting Google scripts, or automatically submitting a request.
- Retry a failed widget once when the user submits; missing/failed tokens still
  prevent submission and retain the existing server-side validation.
- Preserve existing branding/privacy and mobile badge styling in this scoped
  recovery change; hiding a badge is not a connectivity repair.

The API follows https://developers.google.com/recaptcha/docs/faq (explicit v3
rendering uses `size: invisible` and the returned client ID) and
https://developers.google.com/recaptcha/docs/invisible (`error-callback` and
`grecaptcha.reset`). It does not use undocumented runtime internals or disable
security, consent, CSP, extensions, or VPN.

Local checks: 134 tests, lint, and isolated production build passed. Synthetic
browser fixture verified late-error display, one reset, retained text in the
inquiry field, and no navigation on retry. The fixture blocks outbound third-party
resources and all API/submission requests; it cannot establish Google's real
token delivery or production recovery. Evidence and the local-only fixture are
under `outputs/marketing-health/recaptcha-recovery-2026-10-23/` and
`outputs/marketing-health/deployed-audit-reconciliation-2026-10-23/`.

Final visual checks covered desktop and a 390px mobile iframe viewport. The inline
notice fits the inquiry form; the retry count and root widget persist across the
CT trailer -> CT service client-side transition. An initial page-level notice was
covered by the existing fixed header during testing and was replaced by the
in-form component before handoff. No production form data was used.

Release authorization: the user approved committing and pushing this follow-up
to master on October 23, with budgets unchanged. Deployment remains pending the
user's pull, rebuild, and PM2 restart. The network cause remains unconfirmed.
After deployment, recheck direct and
internal navigation, widget callbacks, and recovery with Google's real runtime.
Do not claim the intermittent connection issue fully resolved from fixture tests.

The separately approved email was sent from mack2356@gmail.com to
mauricelm@xwf.google.com at 12:18 PM Pacific on October 23 in the existing
`[4-6370000041195] Tracking update and follow-up questions` conversation. No CC,
campaign, bid, budget, goal, or GTM changes were made in this follow-up.
