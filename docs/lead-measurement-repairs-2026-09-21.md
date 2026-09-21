# Lead measurement repairs - September 21, 2026

## Live account and reporting changes

- Created Google Ads conversion action `Connected calls from website (60s)` in account 463-160-0807.
- Primary action; one conversion per interaction; no assigned revenue value; 60-second call threshold; 30-day click window.
- Destination is the existing (559) 537-6851. The account-default Phone call lead goal applies to both campaigns.
- Public tag destination: `AW-18384213473/Bg2YCLSJpIAdEOGro75E`.
- No budget, bid, network, or campaign-launch changes. Both authorized budgets remain $15/day.
- Reviewed the Glenchoice inquiry as MRI trailer intent. Mail metadata, accepted event, funnel, and daily category counts now agree. Original selected category remains `service_request`; acquisition remains `google_organic`; total accepted leads is unchanged. No email resend or Google conversion upload.
- Google Search Console accepted the PET/CT service indexing request. The public page returned 200, self-canonical, index/follow, and is present in the services sitemap. Acceptance means queued for crawling, not guaranteed indexing.

## Website changes (require deployment)

- Accepted Contact and Service submissions classify trailer business intent separately from the user's selection. Parts inquiries are not inferred as trailer rentals. Inference is marked unreviewed, not sales-qualified.
- Accepted server responses determine the GA lead category, including retry recovery. Late browser milestones cannot overwrite accepted classification/attribution.
- First touch and latest paid-search touch can be retained in browser storage for 30 days after opt-in. These are separate from current-session source and cannot silently turn an organic lead into a paid conversion.
- New marketing preference controls support decline, opt-in, withdrawal, expiration, DNT, and Global Privacy Control. Call measurement is production-only and opt-in. Ad personalization remains denied.
- Website calls use Google's forwarding-number callback to update both the displayed number and `tel:` target, including elements added during navigation. Withdrawal restores the original number. Phone-link clicks remain interaction events, not call conversions.
- Ads CSP destinations added according to Google's documented tag requirements.
- Accepted-lead diagnostics distinguish events queued to the Google tag from callbacks processed by the tag. Neither is proof of Google receipt or Ads attribution. No extra lead events are fabricated.
- PET/CT service has a direct footer link.

## Product repairs and evidence

Exact ID/name/part-number guards fill missing identifiers only. They do not change stock, pricing, visibility, or pictures.

1. `temp-41`, 46-170021P10 Fuse: GE CT. Verified against GE's Discovery/Optima RT pre-installation manual, item 7 in the fuse listing. Existing image also shows the exact GE part number.
   https://www.gehealthcare.com/content/dam/gehc/global/support/site-planning/documents/Discovery-and-Optima-RT-Pre-Installation-Manual-PIM-5366636-1EN-23-ds-en.pdf
2. `a60097f343dc`, BSX73-0893E Converter-16: Toshiba CT. DirectMed's engineering article identifies this older Aquilion Prime converter. No substitution with the newer part was made.
   https://directmedimaging.com/ask-a-ct-engineer-aquilion-prime-s-brush-blocks-2/

Both historical URLs now redirect permanently to their exact canonical product and return 200 locally. Existing product photos load and were visually checked.

## Verification and operation

- Unit tests cover consent, attribution retention, organic-source preservation, trailer intent, forwarding number validation/restoration, conversion deduplication, and guarded catalog repairs.
- Desktop/mobile preference UI checked in the browser. Local preview: http://127.0.0.1:3093/contact
- `node scripts/report-lead-diagnostics.mjs START END` is a bounded, read-only diagnostic report. Missing historical diagnostics are expected before this release.
- `node scripts/review-lead-intent.mjs HASH EXPECTED_SOURCE EXPECTED_FORM CATEGORY MODALITY` previews a single reviewed category correction. `--apply` explicitly writes a guarded, audited transaction. It never sends email or Google events.
- Website-call action will remain unverified/inactive until deployed code is observed by Google. Validate number replacement and the call report after deployment; do not manufacture a lead or click an ad merely to inflate metrics.
- No DigitalOcean console, SSH, or other remote execution was used. Pushing this code does not deploy the website; deployment and live call-tracking verification remain separate steps.

## Google implementation references

- https://support.google.com/google-ads/answer/6095883?hl=en
- https://developers.google.com/tag-platform/security/guides/csp
