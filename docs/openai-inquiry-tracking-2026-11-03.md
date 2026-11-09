# OpenAI completed-inquiry measurement

Status on November 3, 2026: Ads account configuration and local implementation
are complete. Website deployment and genuine paid-inquiry attribution are pending.

## Account configuration

- Data source: **AIS Website - Completed Inquiries**.
- Public pixel identifier: `3dF4iDnpZqFRNDoLVnDHAn`.
- Conversion event: **AIS Completed Inquiries**, base event `lead_created`.
- Linked to **AIS | MRI & CT Service + Rentals | $700 Pilot**; Ads Manager
  confirms use by one campaign.
- The existing campaign remains a Clicks campaign with a **$700 total budget**.
  Its four service and rental ads were not changed by the tracking work.
- The approved conversion-only key is named **AIS Completed Inquiries Server**.
  It is stored in the Git-ignored local `.env.local` under
  `OPENAI_CONVERSIONS_API_KEY`. Never place it in client code, GTM, documentation,
  Git, screenshots, shell history, or chat.
- A bearer-authenticated `validate_only: true` request returned HTTP 200 and
  `accepted_events: 1`. This did not log a conversion or establish attribution.

## Measurement behavior

The browser privately retains a genuine `oppref` from an ad landing URL for up
to 30 days, only after advertising measurement consent. Revocation clears this
reference. It is sent only with inquiry submission context, not ordinary
Google/internal analytics events. Page and referrer measurement excludes query
strings and fragments.

The server reports only accepted service or trailer inquiries, after their
existing persistence transaction succeeds, and only for an eligible production
request with consent and a valid click reference. The payload contains the
event identifier, acceptance time, click reference, fixed public page URL,
`lead_created`, and `opt_out: true`. It excludes contact details, contact
hashes, free text, user agent, and IP address. `opt_out` does not replace the
visitor's measurement consent.

No OpenAI browser Pixel SDK is installed. Ads Manager's automatic advanced
matching setting had no off control in the inspected interface; this server-only
integration does not invoke the SDK's form scanning or send a user/contact object.

Delivery state is stored in the existing accepted-lead analytics document. Only
a fingerprint of the click reference is persisted there. Stable event IDs,
transactional delivery leases, and bounded retries protect against duplicates.
There are at most two attempts during one accepted submission and four attempts
over its lifetime. After those immediate attempts fail, there is no autonomous
background retry: a later confirmed repeat of the same inquiry, with matching
reference and consent, can retry pending delivery. Measurement failures cannot
reject an accepted inquiry. Historical inquiries are not backfilled.

## Verification

- `npm.cmd test`: 178 passed, zero failed.
- `npm.cmd run lint`: passed.
- `npm.cmd run build`: passed, candidate `63514fcdbfd4-mw16iahm`.
- Exact candidate rendered `/contact`, `/service-request`, MRI and CT service
  pages, and both MRI/CT trailer rental pages in Chrome with no captured browser
  warnings/errors. Contact service/rental selection and privacy choices worked.
- Local preview correctly disables submission because the production reCAPTCHA
  key does not allow localhost. No production inquiry was manufactured.
- `.env.local` is ignored and untracked. The exact credential was absent from
  1,362 built client files checked.
- Public `/contact` still reports release `2b9ed3558e88-mvsbvh2g`.

## Deployment handoff

Hosting correction verified during the November 9 recovery: the public website
runs on `ubuntu-s-1vcpu-1gb-sfo3-01`, Droplet **417833875**, IPv4
**164.92.111.36**, with nginx forwarding to the existing `AIS_web` PM2 process.
`ais-web-production`, Droplet **84894838**, IPv4 **192.241.225.202**, is a
distinct legacy host and is not the deployment target for this release. The
November 3 tracking work did not access either server; the separately approved
November 9 recovery restored the public host without deploying this candidate.

`AGENTS.md` requires explicit permission and fresh confirmation immediately
before the planned DigitalOcean console phase, identifying this Droplet and
the actions. Do not substitute SSH or other remote execution to bypass it.
Use [the November 9 release runbook](release-recovery-2026-11-09.md) to preserve
the recovered runtime and prepare a reviewable cutover and rollback.

Activation requires publishing this reviewed code, securely adding only
`OPENAI_CONVERSIONS_API_KEY` to the production server environment, building an
immutable release, and restarting the existing AIS website process. Preserve
the previous release and existing production configuration. Do not replace the
server's entire environment file with the local file.

The current branch also includes two previously pushed changes not yet on the
live version: `a2257dd` (form-security loading and customer phone contacts) and
`63514fc` (sitemap and redirect repairs). A deployment from this branch includes
those changes, so verify their documented checks as well.

After deployment, verify the exact public release header, assets, all inquiry
forms, consent behavior, and OpenAI diagnostics. Confirm actual attribution only
when a genuine eligible ad inquiry arrives. An API validation, page visit, or
direct test inquiry is not proof of a paid conversion. Do not click paid ads or
manufacture production inquiries to create evidence.

## Official references

- https://developers.openai.com/ads/conversion-tracking
- https://developers.openai.com/ads/conversions-api
- https://help.openai.com/en/articles/20001409-conversion-measurement
- https://openai.com/policies/conversion-terms/
