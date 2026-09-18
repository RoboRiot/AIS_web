# Trailer campaign improvements - September 18, 2026

## Live Google Ads changes

Account: 463-160-0807. No campaign budget or bidding-strategy changes were made.

- CT Trailers (24133100082): paused only the phrase-match keyword "CT trailer rental". The exact-match keyword and scanner-specific terms remain active.
- Added CT campaign negatives: phrase-match "u haul", phrase-match "uhaul", and exact-match [trailer rental hartford ct]. Existing exclusions remain in place.
- Saved and reopened both campaign URL settings to verify the final URL suffixes below. Tracking templates were left unchanged.
- Verified CT location targeting is United States with Presence targeting, not Presence or interest.
- Both campaigns remain at $15/day on Maximize Clicks. The existing $10 CPC caps were not changed. No Performance Max or parts campaign was launched.

CT final URL suffix:

```text
utm_source=google&utm_medium=cpc&utm_campaign=ct_trailers&utm_id=campaign{campaignid}&utm_content=ad{creative}&utm_term={keyword}
```

MRI final URL suffix:

```text
utm_source=google&utm_medium=cpc&utm_campaign=mri_trailers&utm_id=campaign{campaignid}&utm_content=ad{creative}&utm_term={keyword}
```

The alphabetic ID prefixes keep numeric ad/campaign identifiers from being mistaken for phone numbers by analytics privacy redaction. These suffixes supplement auto-tagging; they do not replace Google click IDs. Lower-level URL overrides were not exhaustively audited.

## Website changes ready locally

- Integrated the existing pending campaign-attribution work with this repair set. Campaign details survive trailer-to-contact navigation and reloads and are recorded separately from the analytics event property limit. Raw click IDs remain out of general browser analytics and in the restricted lead context.
- Extended general-contact inquiry classification to recognize explicit CT/MRI/PET-CT rental and leasing requests while preserving the user's explicitly selected inquiry category.
- Contact-form verification is now inside the submission error handler. Cleanup always releases the submitting state, and missing verification tokens show a retry/phone fallback.
- Contact form errors include the anonymous lead ID for reconciliation with accepted requests.
- Added permanent redirects for the old combined mobile-trailer URL and three historical service-folder trailer URLs. Query parameters are preserved.
- Added a bounded, read-only diagnostic report for form errors and 404s. It does not export inquiry text, contact details, or click IDs.

The user approved sending the email and pushing this repair set to master on September 18. Production deployment and end-to-end conversion verification remain pending. The repair set includes its related attribution dependencies; do not deploy only the contact-page changes.

## Verification completed

- `npm test`: 74 tests passed.
- `npm run build`: production build succeeded, including lint/type checks.
- `npm run verify:build`: 117 rendered files and 62 asset references verified.
- `git diff --check`: passed; Git emitted only line-ending notices.
- Local production preview: http://localhost:3107/contact
- Desktop contact-form and mobile contact/CT landing-page screenshots inspected. No horizontal overflow at the tested mobile viewport.
- Browser verification: old combined trailer URL redirects to `/trailers`, preserving UTM parameters and the test click ID.
- HTTP verification: `/services/mobile-ct-trailer-rental` returns 308 and preserves query parameters.
- No test inquiry was sent and no production conversion was manufactured. Local reCAPTCHA is not authorized for localhost, so production form acceptance and GA4/Ads receipt still require deployment and a controlled verification.

## Findings and limits

The August 19-September 17 Ads audit showed 78 CT clicks ($329.05) and 36 MRI clicks ($299.13), with zero reported Ads conversions. That is not evidence that the business received no inquiries: email and phone inquiries can lack campaign attribution.

The CT phrase keyword accounted for about 77% of CT spend and admitted nonmedical trailer intent. This is why targeting was tightened before allowing higher bids across the account.

The server diagnostic found one paid-search 404 on the old combined trailer URL on September 17. Recorded timing errors were from before the existing September 11 timing-recovery change; they are not proof that recovery is currently failing. Security honeypot rejections remain enabled.

A genuine September 9 PET/CT inquiry was found in the connected business inbox. Do not retroactively label it a Google Ads conversion without a matching source record.

Phone/email link clicks are not confirmed calls, submitted inquiries, or qualified leads. Website-call conversion coverage and CRM qualification imports remain separate work; no phone click was promoted to a primary lead conversion.

## Next-stage gate

1. Push and deploy the complete reviewed website repair set.
2. Verify production trailer and Contact submission paths, including one accepted request, one deduplicated `generate_lead`, correct campaign attribution, and eventual GA4/Ads receipt. Keep test activity out of business performance totals.
3. Reconcile real inquiries against backend records and distinguish form leads, actual calls, email clicks, and qualified opportunities.
4. Once measurement is verified, test MRI's CPC cap at $12.50, holding its daily budget at $15 and leaving CT unchanged. Compare search-term relevance, auction coverage, actual CPC, accepted leads, and cost per qualified lead. A short test may be inconclusive at this traffic volume.
5. Defer Maximize Conversions and PMax until conversion measurement is reliable and there is a reviewed lead-quality feedback process. No additional PMax budget is authorized by this change set.

## Email communication

The user approved the final conversation preview, which was sent to Mauricel on September 18, 2026. Gmail confirmed SENT (message ID `1a0b57f5047fb682`). The original working draft below is retained as context; the sent message used the slightly shorter final conversation wording with the same decisions.

### Original working draft

To: Mauricel Martinez <mauricelm@xwf.google.com>

Subject: Advanced Imaging: Initial Campaign Improvements and Next Steps

Hi Mauricel,

Thank you for the meeting and for sending over your recommendations. After reviewing our campaign performance and website analytics, we have decided to start with a staged approach focused on relevant traffic and reliable lead measurement.

We are keeping both the MRI Trailers and CT Trailers campaigns at $15 per day. We have tightened CT targeting by pausing the ambiguous phrase-match "CT trailer rental" keyword while retaining exact-match and scanner-specific terms, and adding exclusions for nonmedical trailer searches. We have also added distinct campaign tracking parameters to both campaigns.

On the website, we have prepared and locally tested improvements to campaign attribution, trailer inquiry classification through the Contact page, form-error handling, and legacy trailer URL redirects. Deployment and end-to-end conversion verification are the next steps.

We are holding the existing bidding settings for now. Once tracking is verified, our next planned test is to raise the MRI CPC cap from $10 to $12.50 while keeping its $15 daily budget unchanged. We prefer this controlled test over removing both caps immediately, since the current data also points to search-intent and measurement issues, not just bid constraints.

We will defer Maximize Conversions and Performance Max until we can reliably connect campaign activity to genuine inquiries and assess lead quality. Our goal is more qualified trailer opportunities, rather than additional low-cost clicks alone.

Could you help us review impression share lost to budget versus rank and confirm the form and website-call conversion setup? A weekly check-in would be helpful as we evaluate the changes.

Best regards,
Igor Savchenko
Advanced Imaging Services
(559) 537-6851
