# Google Tag Manager installation

Container: `GTM-MQJJ4Z5S`

The root layout includes the loader in `<head>` and the standard hidden
`<noscript>` iframe as its first authored `<body>` element, covering all routes
using that layout. Next.js may insert an internal hidden placeholder before it.
The JavaScript loader uses the existing production-host and automated-traffic
exclusions and does not load for Do Not Track or Global Privacy Control.
Advertising storage, user data and personalization default to denied before GTM
loads. The existing Marketing privacy control continues to update consent.
The current analytics-storage behavior is unchanged.

## Existing tracking stays in place

This installs the container only. GA4 configuration/page views, accepted-lead
events, and Google Ads website-call tracking still run through the existing site
integration. Do not publish duplicate GA4 configuration, page-view, lead, or Ads
conversion tags in GTM without a separately tested migration that disables the
equivalent site implementation.

On October 22, 2026, a read-only fetch of the public container returned HTTP 200
and resource version 1 with empty tags, predicates and rules. Future GTM publishes
can change this independently of a website release.

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

No campaign settings, budgets, remote GTM tags, privacy policy, or terms are
changed by this installation.

## Local verification (October 22, 2026)

- All 105 unit tests and ESLint passed.
- The production release build and asset-integrity checks passed. Existing Sass
  and Node deprecation warnings remain.
- Generated HTML from 31 core, service and trailer pages contained exactly one
  head loader and the body fallback in the expected position. The compiled inline
  script also passed a simulated-browser execution check without real Google
  requests.
- The website has not been deployed with this change. Live Tag Assistant and
  genuine-inquiry verification remain post-deployment checks.
