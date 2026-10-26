# Legacy URL repair and MRI budget change - October 26, 2026

## Cause and scope

The current-link crawl and requested-URL diagnostics measure different things.
The October 26 crawl checked 543 pages without a current navigation failure,
while 11 separately requested old-style URLs returned 404. They were not
necessarily newly broken links. The release at the start of this change was
89d1176; restarting it does not create missing redirect mappings.

The original alias generator used imported product names. Some names lost
words or gained duplicated revision suffixes, while their descriptions retained
the original headings. The resolver now includes those preserved headings from
structured, labeled descriptions. Collisions remain unresolved rather than
silently choosing an item. An explicit registry covers reviewed URL variants
and a newer catalog item absent from the historical import.

## Verified destinations

The nine routes in `app/data/verifiedLegacyProductRoutes.mjs` were matched using
the complete part number, current Firestore document ID, manufacturer and public
catalog readiness. Database access during this work was read-only. The runtime
continues to reject hidden, missing, incomplete or identity-mismatched records.
The resolver cache version was advanced so cached misses are not retained after
deployment. Canonical URLs are still built by the existing stable-ID helper.

Eight targets already had valid public identifiers. The historical motor record
9f27cda675d8 had a null PN/OEM and the wrong CT modality. Its exact name and
description identify 46-282360P1 Long Drive Motor MG3-A7. GE confirms that precise
part and MRI application:
https://mx.services.gehealthcare.com/gehcstorefront/p/46-282360P1

The repair is restricted to that exact ID, original name/description and compatible
PN/OEM. It does not substitute the -H revision or change inventory. Public copy
for this restored record requests current availability rather than repeating
the historical stock/warranty claim. Original database data is unchanged.

The breast-coil destination is SCF3CFB5F1B321 / 5145567-2, not 5145567-2-R.
Evidence is also in `data/GE/final-GE-catalog.json`, with the original GE source:
https://services.gehealthcare.com/gehcstorefront/p/5145567-2

Numeric `/parts/page/N` archive URLs permanently redirect to the replacement
searchable `/parts` catalog. The previous ordering cannot be reconstructed, so
we do not pretend to preserve page N. Query parameters survive the redirect.

## Deliberately unresolved

`/products/power-brush-2189175` remains 404. The research catalog contains
2189175 Signal Block Brushes but no reviewed product image; the referenced
SC3D8F36BA55BF document is absent from the live Parts collection. Neither an
exact PN query nor the original catalog provided a public destination.
Do not redirect it to another brush, the homepage, or a fabricated product.
Publishing a genuine replacement listing requires approved product information
and imagery. Arbitrary unknown URLs and malformed archive pages also remain 404.

This is not a claim that every historical URL on the internet is recovered.
A Wayback CDX request timed out; checked-in history, requested paths and current
catalog identities were the available evidence. Future observed URLs can be
added to the same reviewed registry and verified with the repeatable script.

Privacy policy and commercial terms remain outside this change.

## Validation and deployment

- Unit suite: 146 passing tests, including exact identity, revision/manufacturer
  mismatch, ambiguous heading, hidden record, missing image and unknown URL cases.
- ESLint passed. Production build passed with existing Sass/Node deprecations.
- Built-site HTTP checks: nine product redirects tested cold and warm, each 308
  to a matching 200 product; three numeric archive redirects with query retention;
  three intentional 404 cases. Prior redirect and core-page checks also passed.
- Chrome rendered the restored motor page with the correct MRI category.
- User will pull, rebuild and restart. Pushed code is not a production deployment.

After deployment run:

```sh
node scripts/verify-legacy-product-redirects.mjs https://advancedimagingparts.com
node scripts/verify-health-repairs.mjs https://advancedimagingparts.com
```

Confirm `X-AIS-Release` matches the new commit before declaring the live repair
complete. GET-only checks do not submit forms or prove conversion receipt.

## Google Ads approval and verification

The user approved MRI $25/day on October 26, leaving CT $15/day and both maximum
CPC limits $12.50. Google required identity verification, which the user completed.
The budget was then saved and verified after a full browser reload in account
463-160-0807. Both bidding settings were separately inspected. Maximize Clicks,
campaign goals, targeting and CT budget were not changed.

This supersedes the earlier $20/day MRI monitoring baseline. The combined
average daily budget is now $40. Full-month planning allowance at unchanged
settings is $1,216, not guaranteed spending or a forecast of qualified leads.
