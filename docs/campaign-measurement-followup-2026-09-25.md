# Campaign and measurement follow-up - September 25, 2026

## Applied in Google

Google Ads account 463-160-0807, CT Trailers, Ad group 1:

- Added campaign-level negative exact keyword `[trailer rentals ct]`. The existing singular exclusion did not cover this plural query.
- Added `[ct scanner rental]`, `"ct scanner rental"`, `[mobile ct scanner lease]`, `"mobile ct scanner lease"`, and `[cat scan rental]`.
- Confirmed 24 keywords after saving. All five additions entered review; the two lease keywords and cat-scan keyword also showed low search volume.
- Kept the ambiguous phrase `"CT trailer rental"` paused.
- No budget or bid changes: MRI and CT remain $15/day, and the MRI-only $12.50 CPC experiment has not started. No PMax or parts campaign launched.

Search Console:

- Checked the first 25 listed Redirect error examples, spanning September 1-9 crawls in the September 20 report.
- All 25 returned one 308 redirect to HTTP 200, with a self-canonical URL, a matching rendered product ID, and no observed noindex directive.
- Requested validation. Search Console confirmed **Validation started, Started: 9/25/26**.
- This is a bounded sample, not proof that all 765 reported URLs are repaired or indexed. Redirected legacy URLs are not expected to be indexed themselves.

## Website changes in this release

- Added allowlisted, client-reported operational context to accepted inquiries: analytics eligibility, Google script load state, and marketing consent state. No cookies, URLs, personal contact details, or click IDs are included in this new context.
- Persisted this context with the accepted lead, canonical submission event, and funnel record for both Contact/trailer and service-request APIs.
- Suppressed duplicate tag-processed diagnostic callbacks. This does not change the number of primary lead conversions or relabel organic leads.
- Made the read-only diagnostic report reconcile unique server-accepted lead IDs against queued/processed diagnostics. It now distinguishes reported privacy opt-out, excluded environments, script-load failure, missing signals, and legacy/unknown context. A callback is explicitly not proof of GA receipt or Ads attribution.
- Added trailer planning FAQs covering unit-specific site documents, project costs versus one-year starting prices, and the availability/delivery confirmation process. The rendered FAQ and JSON-LD use the same content.
- Restricted related trailer links to the current modality so CT visitors see CT rental alternatives and MRI visitors see MRI alternatives.

## Reconciliation findings

The bounded backend review for September 18-24 UTC found seven accepted inquiries: six Google organic and one direct. None had a verified paid acquisition. The three inquiries accepted after the latest release each had queued and processed diagnostics, with duplicate processed callbacks. The other four were before that release and lack enough historical context to determine why their browser signals are absent.

Glenchoice remains an organic MRI trailer inquiry. No retrospective Ads conversion, fabricated paid touch, customer outcome, test lead, or test call was created. Recording qualified/quoted/won status still requires the actual sales outcome; the user was asked for the Glenchoice status.

GA's aggregate attribution is not a per-lead delivery receipt. In particular, the Cross-network / data-not-available entry must not be assumed to represent a PMax campaign or reassigned to an Ads campaign. The legacy source labels and unresolved attribution still require diagnosis; no unsupported historical relabeling was performed.

## Verification

- `npm test`: 84 passed, 0 failed.
- `npm run build`: passed, including lint/type checks and immutable-release verification; 117 rendered files and 62 static references.
- Desktop CT and 390px mobile CT/MRI browser checks: no horizontal document overflow; working inquiry anchor navigation; expected form controls; rendered trailer imagery; six CT and seven MRI FAQs matching their schema text.
- No production forms submitted during verification. Local/browser automated traffic is excluded from analytics collection.
- No DigitalOcean console, SSH, or remote execution used.

## Remaining gates

1. Deploy this release after publication to master, then check the release header and new diagnostic context on subsequent genuine inquiries. A Git push alone is not deployment. Droplet console access requires a separate, fresh confirmation under the standing server-access restriction.
2. Reconcile downstream GA receipt and Ads attribution for eligible leads; the available aggregate UI and browser callbacks do not complete that check. Verify a genuine connected website call separately.
3. Record actual qualification outcomes, including Glenchoice, without changing their acquisition source. Obtain approved unit specifications and real deployment examples before publishing those claims.
4. Once measurement is validated, start the agreed MRI-only $12.50 CPC-cap test, keeping its $15/day budget and CT bidding unchanged. Review after seven complete days of that actual experiment, not seven days from these preparatory changes.

Stage 2 has not been represented as launched or fully cleared.
