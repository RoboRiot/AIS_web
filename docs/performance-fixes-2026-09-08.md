# September 8 Performance Fixes

## Implemented in the Website

- Product routes cache product data, not redirect responses. Canonical redirects run before page rendering. Three URLs from the Search Console redirect-error report were checked cold and warm: each returned 308 with Location, followed by a 200 canonical page.
- reCAPTCHA script loading and execution are bounded. The API distinguishes expired tokens, wrong action/hostname, and score rejections. Only an expired token gets one automatic retry, retaining the same lead ID. Spam controls remain enabled.
- A general contact message about trailers is classified as a trailer inquiry without unexpectedly requiring a previously hidden phone field. Phone is visible and optional for general/parts inquiries, required for explicitly selected service/trailer inquiries.
- Successful submissions return a shared analytics lead ID. Restricted browser storage or analytics errors cannot prevent submission or make an accepted inquiry display an error. New accepted leads start as `unreviewed`, not qualified.
- Analytics removes contact details from search/event text and private query parameters from GA page locations. Ad click IDs and acquisition campaign parameters are retained for attribution. Browser analytics still respects existing collection rules and Do Not Track.
- General catalog searches try normalized part-number indexes as well as text indexes. Partial index failures do not erase matches from successful lookups.
- No-result searches offer a sourcing inquiry with the requested part number and filter context prefilled. They do not fabricate inventory matches or availability.
- Homepage CT tubes exclude tube accessories. Product links use complete canonical product information; malformed empty braces are removed from names. The mixed relevance carousel is labeled Featured Imaging Parts rather than claiming measured request popularity.
- Service/trailer landing pages have visible H1 headings and no empty subheader banner. Shared subheader headings on other pages are visible. Gallery stacking and several text labels are corrected.

## Live Google Ads Changes

Budgets and bid limits were not increased. Both campaigns remain at $10/day.

CT Trailers, campaign 24133100082:

- Added exact negative `[trailer rental connecticut]`.
- Added exact negative `[trailers for rent in ct]`.
- Added phrase negatives `"car trailer"`, `"enclosed trailer"`, `"motorcycle trailer"`, `"cargo trailer"`, `"utility trailer"`.
- Added `"mobile ct scanner rental"`, `[mobile ct scanner rental]`, `"rent mobile ct scanner"`, `[ct scanner trailer rental]` to Ad group 1.
- Verified all four additions in the 19-keyword table. They are under Google review; `[ct scanner trailer rental]` is also flagged for low search volume.
- Existing medical rental keywords remain enabled. Connecticut itself was not excluded.

MRI Trailers, campaign 24127047002:

- No targeting changes saved. Exact exclusions `[mobile mri]` and `[mobile mri near me]` require user approval because those ambiguous searches may include legitimate buyers. The safety reviewer blocked that change, and approval was requested.

Conversion setup checked: Website Form Submission imports GA4 `generate_lead` from `magmo-ac10c`, is Primary, and counts One. The other primary action is a separate Google-hosted lead form. Neither `form_open` nor `form_error` is listed as a primary conversion. No conversion settings were changed.

## Verification

- `npm test`: 47 passing tests.
- `npm run build`: production compilation, lint/type checks, and immutable release asset validation passed.
- `scripts/verify-performance-fixes.mjs`: local production checks at 1440px and 390px. Homepage, contact, parts, CT/MRI trailer pages, and MRI service page have one visible H1 and no horizontal overflow. Galleries loaded after background/resume and image selection. Trailer token retry, contact classification with optional phone, and no-result sourcing passed.
- Browser test submissions were intercepted locally. They did not send emails or create production lead events. Real inbox delivery and live reCAPTCHA acceptance remain post-deployment checks.
- Local API found known part `46-265887P2` from both search boxes. `PX72-07040-2` still returns no public match; use sourcing rather than claiming it is in stock.
- QA screenshots and preview logs are ignored under `.tmp/`. This is not a Lighthouse or field Core Web Vitals certification.

Run against a local production preview:

```powershell
$env:PLAYWRIGHT_MODULE = "C:/path/to/node_modules/playwright"
$env:AIS_VERIFY_URL = "http://localhost:3091"
node scripts/verify-performance-fixes.mjs
```

## Deployment and Remaining Work

1. Commit/push and deploy the website changes using the existing immutable release procedure. The live Ads changes do not deploy website code.
2. On production, keep `NEXT_PUBLIC_SITE_URL=https://advancedimagingparts.com` and a matching reCAPTCHA key/secret. The canonical production hosts are allowed by default. Only if an authorized staging hostname needs form testing, add it to server `RECAPTCHA_ALLOWED_HOSTS` and to the key's allowed domains in Google reCAPTCHA. Never disable hostname/action/score validation to make tests pass.
3. Retest the sampled redirects on production, including the reverse proxy. Then start Validate Fix for Search Console's Redirect error report. Passing three samples does not establish that every one of the 765 historical failures has the same cause.
4. Make one clearly labeled real trailer test and one contact-page trailer test after deployment. Confirm inbox receipt, one accepted first-party lead per inquiry, matching accepted lead ID in GA4 where analytics is permitted, and proper source attribution. Do not click paid ads to generate tests. A direct test is not an Ads-attributed conversion.
5. Complete advertiser verification before September 17. Google currently requests SSN confirmation and an EU political-ads declaration. Enter sensitive identity information directly in Google Ads, never in chat. Review the current payer disclosure before confirming it.
6. Qualified-lead reporting is not complete: an unreviewed status is only groundwork. A business reviewer must mark real prospect/solicitation/job/spam outcomes, and Magmo needs an authenticated qualification workflow. Call attribution and consent-appropriate offline conversion imports also need separate setup. Do not treat every accepted form or phone-link click as a qualified lead.
   These collection fixes apply to future events; they do not reconstruct missing historical attribution or eliminate consent-related GA4 differences.
7. Review remaining Search Console 404/canonical/indexing samples individually. Redirect old products only when an equivalent live product is known. No blanket homepage redirects, invented prices, or invented stock/reviews were added.
8. Segment unusual short-engagement direct traffic for analysis; no blanket country blocking or irreversible GA traffic deletion was applied. Run a production mobile performance audit before making speed/Core Web Vitals claims.
9. Compare qualified inquiries and exposed search terms over the next one to two weeks before raising budgets. A higher optimization score or lower CPC alone is not evidence of better business performance.
