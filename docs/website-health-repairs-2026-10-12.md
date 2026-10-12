# Website health investigation and repairs - October 12, 2026

## What the tracking failures mean

Read-only first-party diagnostics for October 1-12 (UTC) contained 15 accepted
inquiries: 12 with a queued browser lead event, 8 with a browser processed
callback, and 3 explicit privacy opt-outs. Four accepted inquiries reported a
failed Google script load: October 2, twice on October 6, and October 12. All
four were parts inquiries, not confirmed trailer calls. Their first-party
session records indicated Google organic traffic, not paid attribution.

The broader date window explains why this investigation found four failures
instead of the three highlighted in the recent daily review. A failed tag is
not a failed form: these inquiries were accepted by the backend. The recent
email-service records checked showed successful processing, but that is not
proof of inbox placement, a human reading the email, or Google receiving a
conversion. Browser callbacks also are not Google receipt confirmations.

The historical records did not retain a network error or blocker reason. It
would be incorrect to claim that all four were caused by one specific browser
setting or by the site's CSP. The confirmed code defects were no recovery
after a script load error and a report classification that hid failures behind
the less-specific queued status.

## Implemented repairs

- A singleton Google tag loader retries the same official URL after actual
  load errors, with at most three attempts. It waits for connectivity when
  offline and never starts a parallel copy just because a request is slow.
- Enforced script CSP failures stop retries. DNT, GPC, automation exclusions,
  and local-environment exclusions remain respected. No proxy or alternate
  domain is used to evade blocking, and no historical conversion is replayed.
- Internal-only tag health events record bounded attempt counts and diagnostic
  categories. Accepted inquiries preserve this context, and explicit load
  failures now take precedence over queue-only diagnostics. A later processed
  callback remains distinguishable from confirmed Google receipt.
- CSP permits Google's documented regional Analytics collection subdomains,
  without allowing arbitrary third-party connections. This is preventive
  compatibility work, not a proven explanation for the historical failures.
- Two verified legacy product paths permanently redirect to their exact
  catalog matches. ID, part number, and name guards prevent guessed matches:
  `/products/vct-64-center-digital-module-kit-sherlock-5136400-3` and
  `/products/kgtsm-px79-11217`. Unknown products still return 404.
- Quote-only product pages use WebPage/Thing and Breadcrumb structured data
  instead of requesting Product rich results without published offers or
  product reviews. No prices, availability, or ratings were fabricated. This
  does not remove the pages from ordinary organic search; Search Console will
  need to recrawl before old enhancement warnings change.
- Dynamic product/category JSON-LD escapes `<` to prevent catalog text from
  terminating its script element.
- Patched production dependencies, including Next 15.5.27, Sharp 0.35.5, gRPC,
  PostCSS, and UUID. Updated dynamic route parameters for Next 15. Production
  npm audit findings fell from 21 to zero at the time of this investigation.
- Replaced deprecated `next lint` with a direct ESLint command so linting does
  not trigger the repository's immutable-production-build guard.

## Verification

- 95 local automated tests pass, including bounded retries, queue deduplication,
  offline recovery, CSP failures, privacy gates, aliases, and structured data.
- `npm run lint` passes.
- The production build passes. Local testing uses Node 22.13.1.
- Read-only production-build HTTP checks verify cold/warm permanent redirects,
  destination identity, schema, nine core routes, CSP, and a genuine unknown
  product 404. Repeat with `node scripts/verify-health-repairs.mjs BASE_URL`.
- Local asset audit: 81 pages and 1,065 same-origin resources checked, all
  passing. This is sampled product coverage, not the entire catalog.
- Fresh public rolling audit: 543 pages (41 core and 500 products), 171
  discovered internal URLs and one external footer destination checked with
  no reported failures; 127 other discovered links deferred. The persisted
  product queue has checked 3,000 of 7,980 products within its 32-day window,
  leaving 4,980. These counts do not include the known legacy paths repaired
  in this patch, which require deployment before public retesting.
- Desktop/mobile browser checks covered MRI landing-page rendering, mobile
  navigation, contact inquiry selection, catalog search and product details.
  No lead was submitted. Local reCAPTCHA correctly rejects localhost; that
  is not evidence of a production reCAPTCHA failure.

## Still requiring action or verification

1. **Deployment:** push and deployment are separate. The repository has no
   documented automated deployment hook/workflow. Do not use DigitalOcean,
   SSH, or another remote execution method without the user's explicit access
   authorization and required fresh console confirmation. The production
   runtime must be Node 20.9 or newer for the patched image dependency. Have
   the authorized operator check the runtime, install the lockfile, build a
   release, and restart using the established deployment procedure. Verify
   the live release header and repeat the HTTP checks afterward.
2. **Legal pages:** `/privacy-policy`, `/terms`, and `/terms-and-conditions`
   have been requested but do not exist. No approved policy text or current
   internal links to them were found. Publish only company-approved text;
   do not invent legal commitments or redirect them to an unrelated page.
3. **Development dependencies:** full npm audit still reports five high
   findings in the braces/micromatch/fast-glob/Next ESLint dependency chain.
   They are not production runtime dependencies. No suitable patched braces
   release was available in the registry during this investigation; do not
   force a downgrade of the patched Next lint configuration to hide them.
4. **Image-viewer license:** the existing LightGallery viewer opens images,
   but logs an invalid/default production license-key warning. Confirm the
   company's license or approve replacement; do not silence or invent a key.
5. **Catalog assets:** some legacy products still display a branded image
   instead of a photograph of the part. The local server also observed a 404
   from the upstream storage object `Parts/temp-204/temp-204.jpg` while
   displaying the D3887t listing; the card's existing fallback prevents a
   broken-image icon but is not a real product photo. Same-origin asset audit
   coverage does not prove that every remote catalog image exists. Obtain
   verified photos before representing these listings as photo-complete.
6. **Connected calls:** no call was placed and no Google Voice setting was
   changed. A real incoming call is still needed to validate phone ringing,
   routing, connection, and eligible Google call-conversion reporting.
7. **Downstream tracking:** after deployment, observe new genuine inquiries
   and compare first-party records with GA4/Ads after reporting lag. Do not
   relabel organic or unknown leads as paid, and do not count phone-link
   clicks as connected calls.

No advertising settings, budgets, Voice routing, consent decisions, or remote
server settings were changed during this investigation.

## References

- [Google tag CSP guidance](https://developers.google.com/tag-platform/security/guides/csp)
- [Product snippet eligibility](https://developers.google.com/search/docs/appearance/structured-data/product-snippet)
- [Next 15 upgrade guidance](https://nextjs.org/docs/app/guides/upgrading/version-15)
