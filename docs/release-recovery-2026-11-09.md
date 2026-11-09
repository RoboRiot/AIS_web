# AIS release after outage recovery — November 9, 2026

Status: deployment and tracking repair are authorized; this document prepares
the release. It does not record a deployment. Commands below are a runbook,
not evidence they were executed. The current candidate must finish its release
checks and the console phase must receive the required fresh confirmation.

## Confirmed target and recovered state

- Public target: `ubuntu-s-1vcpu-1gb-sfo3-01`, Droplet **417833875**,
  **164.92.111.36**, Ubuntu 24.04, 1 vCPU / 1 GB RAM / 25 GB disk.
- The separate legacy `ais-web-production`, Droplet **84894838**,
  **192.241.225.202**, is not this release's target.
- November 9 recovery removed only the approved npm download and webpack
  compiler caches. The user completed the forced password change and reached
  an installed-system root shell. A later ordinary login was not retested.
- nginx is active and enabled, with listeners on 80 and 443. Existing site
  configuration proxies to `localhost:3000`; PM2 restored `AIS_web`.
- Public HTTPS returned 200 and `X-AIS-Release: 2b9ed3558e88-mvsbvh2g`.
  That application used Next **14.2.35**. Homepage, contact, CT/MRI trailers,
  GE MRI listing, one product, and service-request rendering were verified.
  No production form was submitted and no test call was placed.
- Latest measured normal-boot capacity: **4.2 GB free**, 83% disk use,
  **961 MiB RAM**, **563 MiB available**, and **no swap**. Recheck before work.
- Protective snapshot `ais-417833875-pre-recovery-20261109` is retained
  (24.87 GB, approximately $1.49/month). It predates password change and nginx
  restoration; restoring it would also revert those recovery changes.

Evidence: `outputs/marketing-health/recovery-completed-2026-11-09.json`,
`recovery-cache-cleanup-2026-11-09.json`, and
`release-status-2026-11-09.json` in the same evidence directory.

## Candidate and local checks

GitHub master was verified as `63514fcdbfd4209122358460f09e0642d42a1f05`, two
commits ahead of production: October 28 form-security/phone-contact changes,
then November 2 redirect/sitemap repairs. The working tree additionally holds
authorized tracking work. Preserve unrelated dirty files and commit only the
reviewed release scope. Record the final full SHA and clean candidate file set.

The candidate lockfile/package targets **Next 15.5.27** and requires
**Node >=20.9.0**. This is an upgrade from the recovered production runtime,
not merely a release-pointer change. The version is the currently reviewed
candidate; this runbook does not assert it is the newest available Next release.

The final tracking source passed **186 tests and lint** on November 9. An earlier
build passed before the one-line contact initialization fix; the final committed
candidate must be rebuilt. Browser preflight and public deployment validation
remain pending at this document's preparation. Earlier November 3 results
belong to their earlier candidate and must not substitute for these checks.

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

`npm run build` invokes `scripts/build-release.mjs`; do not invoke `next build`
directly. It verifies rendered asset references and complete sitemap files,
retains historical static assets, and only then promotes the local release
pointer. With an explicit `AIS_NEXT_DIST_DIR`, it does not promote that pointer.
Build names derived from Git HEAD do not prove a dirty tree's contents; freeze
and record the final reviewed source before publishing.

## Console confirmation and read-only prerequisites

`AGENTS.md` requires a fresh confirmation immediately before using the
DigitalOcean web console. Identify Droplet 417833875 / 164.92.111.36 and the
planned inspection, preparation, release/cutover and rollback actions. Existing
deployment authorization remains valid; this is the separate console-access
requirement. Do not use SSH or another execution path to bypass it.

After that confirmation, verify identity and capacity:

```sh
hostname
id
node --version
npm --version
df -h /
df -i /
free -h
swapon --show
```

Read the installed application's source status and release marker. Inspect
only the PM2 launch fields needed to reproduce the existing process: name,
cwd, executable/script, args, interpreter, process mode, and applicable
release-selection overrides. The process name `AIS_web` is known; its exact
launch command and environment precedence are not yet captured. Do not print
full PM2 environment/dump files, credentials, or the production environment.

No deployment script, CI workflow, or PM2 ecosystem file was found in this
repository. Do not invent the missing launch configuration or blindly restart
with `--update-env`. In particular, `AIS_RELEASE_ID` and `AIS_NEXT_DIST_DIR`
can override `.next-release-current` in `next.config.mjs`.

## Capacity and rollback gate

Do not assume a production build is safe alongside the live process with
563 MiB available and no swap. The repository declares no RAM minimum or build
worker cap. Select and document a build resource plan using fresh measurements;
include any required swap, resize or alternate build host in the concrete plan
before making that additional infrastructure change.

Measured Windows candidate sizes are planning references, not Linux peak
requirements: node_modules 541 MiB; recent immutable build 190 MiB; retained
static archive 35 MiB. Installation caches, Linux native dependencies, build
temporary files, old-runtime retention and operating headroom are additional.
Do not copy Windows node_modules as the production Linux runtime.

Before installation or cutover, preserve a complete runnable rollback:

- Current source checkout and uncommitted production changes, package lock,
  matching node_modules, Next configuration, and selected immutable build.
- `.next-release-current`, historical `public/assets/next-static`, other needed
  public assets, and existing production environment/configuration with their
  permissions. Keep secret-bearing material private and out of Git/reports.
- Existing PM2 launch definition and persisted startup metadata, plus the
  exact verified rollback/cutover commands derived from those fields.

Use a separate candidate directory/runtime so dependency installation does not
replace the live Next 14 runtime. A retained build folder alone is not a safe
rollback across the Next 14-to-15 dependency change. Keep the old source,
dependencies and process definition until the new release passes validation.
The snapshot is a disaster fallback, not the preferred application rollback.

## Build and preflight the isolated Linux candidate

The candidate directory must contain the exact reviewed source and its own
dependencies. Preserve the live environment without wholesale replacement;
add only the authorized OpenAI conversion setting through a secure method.
Confirm the needed key's presence without printing it. Never put it in command
history, logs, screenshots, client bundles, GTM, or Git.

Copy the current historical `public/assets/next-static` archive into the
candidate before building, so cached HTML from the previous release continues
to find its content-hashed assets. Keep runtime image/fetch caches and old
application releases outside any cache-cleanup assumption.

Set `candidate_release` to a unique ID tied to the final reviewed commit.
From the candidate root, after runtime/capacity preparation:

```sh
npm ci
AIS_RELEASE_ID="$candidate_release" AIS_NEXT_DIST_DIR=".next-releases/$candidate_release" npm run build
AIS_RELEASE_ID="$candidate_release" AIS_NEXT_DIST_DIR=".next-releases/$candidate_release" npm run start -- --hostname 127.0.0.1 --port 3096
```

The last command runs the preview server in its current session. Run the
following checks in another appropriately authorized session; do not interrupt
the live process to create a preview. A failed build or preflight stops cutover.

```sh
node scripts/verify-sitemaps.mjs http://localhost:3096
node scripts/verify-legacy-product-redirects.mjs http://localhost:3096
node scripts/verify-health-repairs.mjs http://localhost:3096
node scripts/verify-site-assets.mjs --base-url=http://localhost:3096 --concurrency=1 --max-product-pages=40
```

Perform a browser preflight of the exact candidate, including inquiry forms,
reCAPTCHA loading/retry, internal navigation, two phone labels, privacy choices,
catalog listing/product detail and desktop/mobile rendering. Local fixtures
may test submission mechanics without creating real leads; they do not prove
production reCAPTCHA acceptance, mail delivery or paid conversion attribution.

## Cutover and public verification

Fill in the precise PM2 cutover and rollback commands only after the installed
launch fields are known. Keep nginx's recovered configuration and the previous
application runtime available. On a blocking post-cutover failure, restore the
previous application/process configuration within the approved rollback plan.
Persist the new PM2 startup state only after it is verified.

Check public HTTPS and the exact candidate `X-AIS-Release`, then run:

```sh
node scripts/verify-sitemaps.mjs https://advancedimagingparts.com
node scripts/verify-legacy-product-redirects.mjs https://advancedimagingparts.com
node scripts/verify-health-repairs.mjs https://advancedimagingparts.com
node scripts/verify-site-assets.mjs --base-url=https://advancedimagingparts.com --concurrency=1 --max-product-pages=40
```

Expected sitemap counts are determined by the current catalog, not hard-coded
from the earlier 7,982-product sample. Every indexed XML file must finish,
contain unique canonical URLs, and pass the implemented response-size gate.

In a fresh real browser, verify homepage, contact, service request, MRI/CT
service and trailer pages, listing/product detail, required assets, phone
labels and fresh console errors. Observe actual consent state without forcing
consent. Verify GA4 requests/receipt and relevant Ads tag behavior; page-view
goals, browser callbacks and form rendering are not accepted or paid leads.
Never click paid ads or manufacture production conversions as validation.

## OpenAI conversion activation and limits

The bounded source review found no new blocking defect in the conversion path.
The server-only key, consent/production/form-type gates, minimal payload,
fingerprinted outbox, transaction leases and stable retry event IDs are present.
The implementation reports only consented service/trailer inquiries with an
OpenAI click reference; it intentionally does not add personal-data matching.
The request shape and timestamp/deduplication rules were checked against the
[official Conversions API documentation](https://developers.openai.com/ads/conversions-api).

Complete a fresh built-client secret-exclusion check before deployment. Current
production key presence and downstream receipt are not established by source
review. HTTP success is recorded locally as accepted; it is not proof of an
attributed campaign conversion. After release, inspect receipt diagnostics and
reconcile the next genuine eligible inquiry with Ads reporting after its lag.
No background retry or historical backfill exists: exhausted immediate retries
depend on a later consented repeat of the same inquiry. Keep this limit visible.

## Owning implementation

- `scripts/build-release.mjs`: immutable build, asset/sitemap gates, archive.
- `scripts/release-config.mjs`: source-derived IDs, pointer read/write.
- `next.config.mjs`: distribution selection, release header, redirects/CSP.
- `scripts/verify-sitemaps.mjs`, `verify-legacy-product-redirects.mjs`,
  `verify-health-repairs.mjs`, `verify-site-assets.mjs`: read-only HTTP gates.
- `docs/openai-inquiry-tracking-2026-11-03.md`: conversion scope and prior tests.
- `app/data/openAiConversions.mjs`: minimal server event and bounded delivery.

## November 9 tracking and ad-review evidence

A live Tag Assistant visit to `/contact` initially had analytics consent denied
and advertising consent granted. After explicitly enabling analytics for this
diagnostic visit, GA4 DebugView received one `page_view`, two `form_open`, and two
`user_engagement` events around 11:50 Pacific. The duplicate contact-open event
was traced to the empty form context followed by URL initialization. The candidate
now waits for that initialization and its lifecycle regression tests pass.
The browser's original analytics-denied choice was restored and debugging ended.
These diagnostic events are not customer inquiries or campaign conversions.

Both CT and MRI final URLs returned HTTP 200 in fresh crawler-user-agent checks.
The authorized Google Ads appeal was submitted for both affected ad groups.
Policy manager confirmed **In progress**, reason **Made changes to comply with
policy**, November 9, 2026. This is a review request, not ad approval.
Evidence screenshots are `ga4-consented-debug-receipt-2026-11-09.jpg` and
`ads-review-requested-2026-11-09.jpg` in `outputs/marketing-health/`.

This runbook makes no deployment, credential-installation, successful production
inquiry, or campaign-attribution claim.
