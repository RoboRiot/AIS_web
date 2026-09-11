# Lead tracking repair status - September 11, 2026

Status: implemented and locally verified. Production deployment and live paid-conversion verification are still required.

## Why this was still unresolved

The previous release was verified as deployed, but that did not verify the full
ad-click -> accepted inquiry -> GA4 event -> Google Ads attribution path.
The separate attachment/service-request form also did not use the previous
expired-token retry improvements. Zero paid conversions alone does not prove a
tracking defect: the reviewed accepted inquiries were recorded as organic,
direct, or referral. The changes below fix reproducible loss/duplication paths;
they do not retroactively classify those inquiries as paid leads.

## Code changes

- A new tagged entry replaces older attribution in the same tab. Internal
  navigation retains the landing path, campaign, and click IDs. Idle attribution
  expires after 30 minutes. An in-memory fallback handles unavailable storage.
- Accepted leads use the server's shared lead ID for GA4 deduplication. A retry
  returning `duplicate: true` can recover a lost original HTTP response, while
  repeated confirmed responses do not queue additional `generate_lead` events.
- GA commands are queued after configuration even if Google's script has not
  loaded. Existing DNT, production-host, and automation exclusions remain.
  Queueing an event is not proof that Google received or attributed it.
- Forms that remain usable after success generate a new ID for the next inquiry.
  Unconfirmed/error retries retain the original ID. Form-start tracking follows
  that identity rather than suppressing every subsequent start on the same form.
- Timing failures can recover once using a server-signed, action/lead-bound
  session timestamp. The client waits at least 2.5 seconds and refreshes
  reCAPTCHA before retrying with unchanged form values. Signatures use the
  existing server reCAPTCHA secret with a distinct signing purpose. No new
  environment variable is required. Honeypot, origin, rate, and reCAPTCHA
  action/hostname/score checks are not bypassed.
- Server timing diagnostics distinguish clock-ahead, expired, too-fast,
  missing-timestamp, and invalid-session cases without logging inquiry contents.
- The multipart service form now uses bounded submission/token/timing recovery,
  retains attachments across retries, and returns the shared analytics lead ID.
- Legacy short product links resolve from the checked-in historical catalog,
  only for unambiguous IDs whose current part number still matches. Current
  image/readiness/visibility requirements still apply; no fuzzy or blanket
  homepage redirects were added.

## Google Ads verified, unchanged

Account 463-160-0807:

- Auto-tagging is enabled.
- Website Form Submission, conversion action 7717339115, imports GA4
  `generate_lead` from magmo-ac10c as a primary Submit lead form action.
- Count: One. Click window: 90 days. Attribution: data-driven, Google paid channels.
- Both campaigns use the account-default Submit lead form goal.
- Budgets remain $10/day each. No bid, targeting, audience, or budget changes
  were made in this repair batch.

## Verification

- `npm test`: 57 passing tests, including 10 new recovery/attribution tests.
- Production build, lint/type checks, and static asset integrity pass.
- `scripts/verify-lead-tracking.mjs` passes against a local production build at
  1440px and 390px. Every browser request is intercepted; no test form,
  synthetic click ID, Google event, or inbox write reaches production.
- Browser checks cover paid CT landing -> contact -> inferred trailer inquiry,
  timer recovery, lost-response retry/accepted duplicate, a distinct second
  inquiry, rejection without conversion, shared lead ID, no contact details in
  GA event parameters, and no duplicate first-party form counting.
- Each of these old URLs returns 308 with Location -> canonical 200 on cold
  and warm local requests: `/products/2-hd-nv-array`,
  `/products/terminal-servrer-pwr-supply`, and
  `/products/lightspeed-performix-40-plus-ct-tube-liquid-bearing`.

Run the browser regression against a local production server:

```sh
npm run build
npm run start -- -p 3092
node scripts/verify-lead-tracking.mjs /absolute/path/to/playwright
```

## Still not proven / not included

This batch is not a claim of production deployment or an observed paid conversion.
After deployment, verify the release header and redirects on the live site,
then reconcile the next genuine eligible paid inquiry's server lead/click ID,
GA4 `generate_lead`, and imported Ads conversion after normal reporting delay.
Do not click your own ads, fabricate click IDs, or upload organic inquiries as
paid conversions. Some consent choices, DNT, blockers, attribution eligibility,
and reporting delays can legitimately produce differences between systems.

Measured calls and qualified-opportunity/offline-conversion imports are not
implemented by this batch. The existing website stores lead attribution and an
unreviewed qualification status, but that is not a working sales-qualification
workflow in Magmo. No ROI claim should be made until qualified outcomes can be
reconciled. Historical source attribution cannot be reconstructed reliably when
no click/session evidence was retained.

Search Console's reviewed indexing snapshot predates the prior deployment;
recrawl/report refresh is still required before judging those reported counts.
The direct-traffic surge and MRI bid/query efficiency remain analysis items,
not reasons to block whole countries or change the approved research budget.
