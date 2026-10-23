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
