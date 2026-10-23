# Google measurement review - October 23, 2026

## Scope and evidence

Reviewed Katkuri's October 22 implementation instructions and Mauricel's October
23 reply in case 4-6370000041195. Google recommends retiring the older call
label, correcting consent timing, and verifying calls and enhanced conversions
at the November 3 technical review. This work does not change advertising
budgets, bids, goal inclusion, Primary status, Voice settings, or customer data
sharing. No synthetic production leads, paid-ad clicks or calls are permitted.

The account's last reviewed budgets were MRI $20/day and CT $15/day. The 26
Primary service/trailer page-view actions remain distinct from successful leads.

## Research and conclusions

1. **Auction and bidding.** Ad Rank depends on bids, quality, thresholds,
   competition, context and assets. Budget increases cannot by themselves fix
   rank or tracking problems. Maximize Clicks seeks clicks within budget; a CPC
   cap can restrict auctions. Maximize Conversions requires conversion tracking
   and may spend more of an underused budget. Do not invent a universal minimum
   conversion count as an eligibility rule.
   Sources: https://support.google.com/google-ads/answer/1722122
   https://support.google.com/google-ads/answer/6268626
   https://support.google.com/google-ads/answer/7381968

2. **Tags, not just action definitions.** Creating an Ads action is not enough:
   the matching ID/label and trigger must actually execute. Both direct Google
   tag and GTM are supported implementations; GTM is not an Ads prerequisite.
   Their coexistence is not automatically duplication. Audit ownership per
   destination/action instead of removing every direct tag. The published GTM
   Ads destination already provides conversion-linking functionality; adding
   another Conversion Linker merely because one is not listed is unnecessary.
   Sources: https://support.google.com/tagmanager/answer/6105160
   https://support.google.com/tagmanager/answer/7549390

3. **Website calls.** Google's number replacement and call-duration threshold
   measure eligible ad-related calls, not all calls to the permanent number.
   A telephone click, voicemail, callback or qualified sales outcome is not
   automatically a website-call conversion. Preserve historical actions while
   retiring duplicate execution. The displayed number and mobile dial link
   must agree; dynamically rendered CTAs need verification too.
   Source: https://support.google.com/google-ads/answer/6095883

4. **Consent.** Explicitly initialize all four consent types before tags/events;
   restore valid saved choices before the first measurement; update immediately
   on the same page when choices change. Unset is not sufficient evidence to
   assert cookies are blocked. Google recommends a CMP/template for GTM and also
   documents the ordered on-page gtag fallback used here. Advanced consent mode
   can send cookieless pings while storage is denied; denied does not mean zero
   network requests. DNT/GPC continue to block these Google integrations entirely.
   Sources: https://developers.google.com/tag-platform/security/guides/consent
   https://developers.google.com/tag-platform/security/guides/consent-debugging
   https://developers.google.com/tag-platform/security/concepts/consent-mode

5. **SPA and duplication.** Direct page loads alone do not test a Next.js site.
   Check internal navigation, back/forward, query changes and anchors. Existing
   filtered History Change page-view triggers are retained. Parent and child
   interest actions overlap and must not be summed into unique leads.
   Sources: https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications
   https://developers.google.com/analytics/devguides/collection/ga4/views

6. **Goal use.** Primary actions contribute to campaign bidding/reporting when
   their standard goal is selected. Google's documentation also says unused
   Primary actions may enhance predictions. Consequently, excluding a goal is
   not proof that Google never uses its data. Nevertheless, ordinary browsing
   is not a qualified inquiry; any future bidding-goal change needs approval.
   Source: https://support.google.com/google-ads/answer/11461796

7. **Attribution and receipt.** A successful Preview or browser callback does
   not establish credited Ads receipt. Attribution needs a qualifying ad
   interaction and applicable windows/consent; an organic visit with no such
   interaction must not be relabeled paid. Compare action-level All conversions
   and conversion-time reporting, not only a campaign's Conversions column.
   Allow import/attribution lag and align Ads, GA4 and first-party timezones.
   Sources: https://support.google.com/google-ads/answer/7521212
   https://support.google.com/google-ads/answer/2544985

8. **Enhanced conversions.** These supplement measurement with appropriately
   collected hashed first-party data. They do not justify sending contact data
   on ordinary page views or overriding consent. Confirm customer-data terms,
   actual conversion triggers, consent and diagnostics with Google's technical
   team before enabling new collection; none is enabled by this repair.
   Source: https://support.google.com/google-ads/answer/13262500

## Implementation decisions

- GTM retains the technician's website-call action/label. Remove the old
  `Bg2YCLSJpIAdEOGro75E` request from application code; do not delete history.
- The app emits `ais_call_tracking_ready` only after advertising consent and
  after a real pathname transition. It does not emit a call conversion.
- `ais_call_tracking_owner=site-consent-v1` in the initial data layer allows GTM
  to distinguish the repaired site from older cached releases. Old releases
  retain their existing page-load trigger; repaired releases use the ready
  event. These paths are mutually exclusive for initial setup.
- A DOM bridge synchronizes the number supplied by GTM in marked header/footer
  with mobile/SPA links, without retrieving another number or using another
  conversion label. Withdrawal restores the permanent business number.
- Analytics and advertising have separate choices. Old advertising consent
  is retained but never expanded into analytics-cookie permission. Unknown,
  malformed, expired and inaccessible preferences default to denied.
- Ad personalization stays denied. Optional first-party visitor/session
  identifiers use memory instead of persistent storage without analytics
  consent. Core form delivery does not depend on measurement consent.

## Release and verification boundary

The website changes need a normal code release. Local build/tests are not proof
of deployment. The GTM migration must be previewed with both old and new release
markers before publication; keep version 6 as rollback. After website release,
verify the head script, consent states, one active call label, direct/SPA mobile
links, and a genuine eligible call in Google's call report. Do not claim an
end-to-end call conversion until that evidence exists. Privacy policy and terms
drafts remain outside this change and still require approval.

## Current workspace checkpoint

GTM workspace 7 now shows exactly 1 modified tag, 2 added triggers and 1 added
variable, with 0 deletions. This is **unpublished**; live version 6 is unchanged.
The fresh version-6 export and scoped import file are retained in
`outputs/marketing-health/tracking-consent-2026-10-23/`.
At the initial preparation checkpoint, no website commit, push or production
deployment had been performed. The user subsequently approved committing and
pushing the tracking repair to `master`, with the website pull/build/restart
handled by the user. GTM publication remains a separate follow-up after that
deployment. Do not publish the workspace or claim live verification merely
because this code is committed or pushed.

## Verification completed locally

- 119 unit tests passed, including consent persistence, blocked storage,
  expiration, privacy-signal overrides, old advertising-only choices, mobile
  number synchronization, withdrawal and exclusion of both call labels from the
  application implementation.
- ESLint and production build `tracking-consent-20261023c` passed. Existing
  Sass/Node deprecation warnings remain.
- The actual compiled head script passed 297 isolated consent scenarios across
  33 generated HTML pages, without Google network requests.
- Chrome checks at desktop and 390 x 844 confirmed the controls fit, grant
  choices persist after reload, and declining does not disable service forms or
  internal navigation. The final compiled build was reloaded and both marked
  phone sources and business-number links were present; no captured client
  errors appeared in that final check. No form was submitted.
- GTM's saved UI confirmed the new event name, equality filter, complementary
  legacy inequality filter, and unchanged conversion ID/label/phone.

Still unverified: the unpublished triggers running in Tag Assistant with the
new production release, Google's actual forwarding-number assignment, phone
ringing/connection, and a credited genuine call in the Ads report. Local DOM
fixtures and script execution cannot establish those results. During an earlier
localhost UI check a reCAPTCHA connectivity warning appeared; it was absent from
the final checked page. Localhost is not proof of production reCAPTCHA delivery.
