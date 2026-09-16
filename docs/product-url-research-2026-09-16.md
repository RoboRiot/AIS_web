# Product URL research - September 16, 2026

## Confirmed restorations

- `/products/bsx73-e-adc2-board`: existing item `b2ede27a56cb` has the incomplete PN `0977`, no OEM, original ADC2 photographs, and description `BSX73-0977*E ADC2 Board`. Restore the full `BSX73-0977E` and Toshiba/CT identifiers only when both the document ID and original description agree. [Block Imaging](https://www.blockimaging.com/parts/bsx73-0977e-toshiba-ct-pwb-adc2) identifies this exact number as Toshiba CT PWB ADC2. [DOTmed](https://www.dotmed.com/listing/ct-scanner/toshiba/aquilion/bsx73-0977e/2113396) independently identifies the part; its retired listing is not evidence of current AIS availability.
- `/products/toshiba-cxb-400c-ct-tube`: existing item `temp-296` has five original image paths and an explicit CXB-400C title, but a null PN. [Block Imaging](https://www.blockimaging.com/parts/cxb-400c-toshiba-ct-cxb-400c-x-ray-tube) confirms Toshiba/CT/CXB-400C. Restore PN only for the exact item ID and matching original title. Do not substitute CXB-400B or claim either is interchangeable.

## Ambiguous names

- `/products/opconta-px79` originally referred to two records: `4cf8a4850db0` (PX79-11179) and `c001d5ead5cc` (PX79-08650). [LBN Medical](https://lbnmedical.com/lbn-spare-parts/) lists several distinct OPCONTA numbers; [AIS's DOTmed listing feed](https://es.dotmed.com/parts/newest/?offset=369420) also identifies PX79-08650 as OPCONTA. The generic name cannot justify redirecting both records to one part.
- `/products/mrc-rot-gs` originally referred to `temp-218` (description PN 9890-000-85103, FD-20) and `temp-219` (description PN 9890-000-85142, FD-10). [Philips' official tube list](https://www.philips.lt/healthcare/resources/recycling-passports/x-ray_tubes) confirms multiple MRC ROT-GS types and 9890-000-85142 as MRC 200 0508 ROT GS 1003. It does not validate every number in the old AIS database or establish interchangeability.

The ambiguous URLs now show existing public catalog records with their full recorded part numbers, not a guessed permanent redirect. Membership requires exact ID and full recorded PN plus the existing catalog visibility and image-field checks. These selection pages use self canonicals and `noindex,follow`; individual canonical product pages remain indexable. Hidden, removed, records without image fields, or identity-mismatched records are excluded. No external pictures are copied and no inventory/availability claims are imported from other sellers.

Visual review found that both OPCONTA records' existing image files contain an AIS logo rather than a product photograph. The selection pages therefore use identifier-based choices without thumbnails; these records are not included in the paid parts test. Fresh original photographs are still needed for those two existing catalog records. The currently public MRC selection includes only 9890-000-85142; the historical FD-20 entry is not forced public.

The original four paths are now covered: two permanent redirects to restored records and two part-selection pages. No database writes are needed; changes take effect with code deployment.
