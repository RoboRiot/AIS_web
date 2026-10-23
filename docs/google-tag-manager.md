# Google Tag Manager installation

Container: `GTM-MQJJ4Z5S`

The root layout includes the loader in `<head>` and the standard hidden
`<noscript>` iframe as its first authored `<body>` element, covering all routes
using that layout. Next.js may insert an internal hidden placeholder before it.
The JavaScript loader uses the existing production-host and automated-traffic
exclusions and does not load for Do Not Track or Global Privacy Control.
All four consent signals are explicitly initialized before GTM loads. Valid
saved choices are restored synchronously; unknown choices default to denied.
Analytics and advertising are separate choices. Ad personalization stays denied.
The Marketing privacy control updates consent before measurement listeners run.

## Measurement ownership (October 23 repair candidate)

GA4 configuration/page views and accepted-lead events remain owned by the site.
The technician's native GTM website-call tag owns number retrieval. The old
application call-label request is removed in this candidate, not the historical
Ads action. Do not add duplicate GA4 or accepted-lead tags in GTM.

The new head script sets `ais_call_tracking_owner=site-consent-v1`. The app emits
`ais_call_tracking_ready` after advertising consent and pathname transitions.
The matching unpublished GTM workspace migration replaces the call tag's All
Pages trigger with mutually exclusive legacy-page-load and new-ready-event
triggers. It does not change any of the 26 page-view tags or Ads goals.

Marked header/footer phone links provide the GTM-replaced number to the app's
mobile/SPA link synchronizer. This does not request a second number or claim a
connected call. Withdrawing advertising consent restores the business number.

Release the website and matching GTM changes as a coordinated, preview-tested
migration. Do not treat the saved workspace or this documentation as proof of a
live release. See `google-measurement-review-2026-10-23.md` for research and gates.

Historical checkpoint: on October 22, a public fetch returned resource version
1 with empty tags. This is superseded by the October 23 UI check: live version 6
contains 28 tags (26 page-view, Ads destination, and website call). GTM can change
independently of a website release.

## Container safeguards and verification

- Review consent requirements on every tag before publishing. Custom/third-party
  tags are not automatically made consent-aware by the site's Google defaults.
- The standard no-JavaScript iframe cannot read the site's browser-local consent
  choice or JavaScript privacy guards. Do not add no-JavaScript tracking pixels
  that depend on consent without a separate consent-compatible design.
- Use Tag Assistant after deploying the site to confirm the correct container,
  consent ordering, and single page-view/conversion delivery. Local and automated
  browsers intentionally do not load the Google containers.
- Tag Assistant recognition, script loads, queued events and browser callbacks
  are not proof of received conversions or downstream lead delivery. Verify a
  genuine consented inquiry against first-party diagnostics and Google reports;
  do not create synthetic production leads.

No campaign settings, budgets, privacy policy, or terms are changed by this
repair. The remote GTM changes are an unpublished workspace draft until verified.

## Historical installation verification (October 22, 2026)

- All 105 unit tests and ESLint passed.
- The production release build and asset-integrity checks passed. Existing Sass
  and Node deprecation warnings remain.
- Generated HTML from 31 core, service and trailer pages contained exactly one
  head loader and the body fallback in the expected position. The compiled inline
  script also passed a simulated-browser execution check without real Google
  requests.
- The website has not been deployed with this change. Live Tag Assistant and
  genuine-inquiry verification remain post-deployment checks.
