# Website reliability repair - November 18, 2026

## Findings, not assumptions

- The public site is Droplet 417833875, 164.92.111.36. Do not deploy to the
  legacy ais-web-production Droplet 84894838 based on its name.
- Fresh public checks showed four missing routes while prior CT archive and
  sitemap redirects worked. The missing repairs were local-only, absent from
  live release bc39bcffbdf1-linux-20261116. A push is not a deployment.
- The regular DigitalOcean console connected without a root-password reset.
  ssh, droplet-agent and nginx were active during the approved inspection.
- Root filesystem: 98% used, 560 MB available; inodes 32% used. About 9.8 GB
  was in /root/AIS_web/.next-releases and 2.4 GB in /var/log/journal.
- Node logged two fatal JavaScript heap exhaustion errors near 470 MB retained
  heap. PM2 recorded exit code 134 at 2026-11-17 13:08:11 and 17:00:26 UTC;
  nginx recorded connection reset/refused and then no live upstreams at matching
  times. The latter incident is the daily audit's mass 502 event, not 527 new
  missing redirects. No kernel OOM match was returned for that UTC day.
- PM2 id 2, AIS_web_badge, runs bash -> npm -> Next from
  /root/ais-badge-bc39bcffbdf1-20261116/app. Its own reported 5.6 MB memory is
  the shell wrapper, not the Next process. No memory restart threshold was set.
- Local 1,000-product full-response serial testing under a 480 MB heap ceiling
  passed. This does not establish the source of long-lived production heap
  growth or prove that the production incident can never recur.

## Repairs and prevention

- Exact /ct -> CT service, /about-us -> /about, Cath Lab archive/pagination,
  and the verified GE 5371622-50 historical product route. No catch-all redirect
  and no fabricated replacement for unknown products. Catalog visibility,
  exact-PN matching and image requirements stay enforced.
- Mobile trailer controls reserve a fixed height and keep the reCAPTCHA badge
  above the action bar. Preserve the already-published privacy-button repair.
- Next.js and eslint-config-next move from 15.5.27 to 15.5.29 (same minor line),
  incorporating official October/November security patches. This is not claimed
  to fix the observed memory growth without production evidence.
- The tracked audit retries transient failures once, stops after three exhausted
  consecutive internal failures, reports one availability incident, preserves
  partial discovery and unattempted work, and persists non-sitemap discoveries.
  An exhausted 502 attempt is not verified link coverage. Empty response bodies
  retain their HTTP status instead of failing when canceling a consumed stream.
- Unit/lint checks run in GitHub Actions without production credentials.
- `scripts/verify-release.mjs BASE EXPECTED_RELEASE REPORT.json` checks exact
  page release headers, all registered legacy redirects, form/phone surfaces,
  every sitemap XML file, and 40 product pages plus core-page assets serially.
  Real desktop/mobile browser verification remains an additional release gate.

## Release procedure and held operations

1. Commit and push the isolated candidate based on the latest origin/master.
   Never overwrite the original dirty working tree or use a force push.
2. Obtain the required fresh server-console confirmation. Run read-only capacity
   and process checks. `scripts/release-preflight.mjs` requires a clean pinned
   revision, 4 GiB free disk, and 512 MiB available RAM for an on-host build.
3. Do not build on a 98%-full filesystem. A proposed cache-only cleanup is
   limited to /root/AIS_web/.next-releases/*/cache, not the active app directory,
   and requires approval. Preserve source, compiled server/static assets,
   runtime env files, logs and complete rollback artifacts.
4. Build on Linux outside the active runtime with explicit AIS_RELEASE_ID and
   AIS_NEXT_DIST_DIR. Do not copy Windows node_modules to Linux or transplant
   unreviewed dependency directories. If the server fails memory/disk preflight,
   use a separately authorized Linux builder or capacity change; do not bypass.
5. Validate the staged runtime on loopback, including this release gate. Capture
   current PM2 launch fields and retain its complete working directory/deps/build.
6. Proposed cutover: supervise the actual Node/Next process directly rather than
   bash/npm. Show exact process/port/env and rollback commands for confirmation
   before applying. Do not improvise a restart, resize, SSH change or reboot.
   `ecosystem.config.cjs` pins the built release, binds loopback, retains a 480 MB
   heap ceiling, and watches the actual process at 450 MB RSS. That restart guard
   is mitigation, not a memory-leak fix or a zero-downtime guarantee; PM2 checks
   memory periodically and a rapid spike can still outrun it. Do not apply it
   without the reviewed cutover approval and genuine runtime evidence.
7. Recheck public HTTPS release ID and all HTTP/browser gates. On failure restore
   the captured old runtime. Save PM2 startup state only after live verification.
8. Track actual Node RSS/heap, restart counts, disk growth and failed requests over
   at least a day. A larger memory allowance is not proof a leak was fixed.
   Retention limits and any resource resize need separate explicit approval.

## Measurement remains separate

No ad budgets, bidding, consent defaults, conversion goals, Voice settings or
account timezones are changed by this release. CT remains $30/day, MRI $25/day,
both CPC caps $12.50. Page views are not inquiries; phone clicks are not connected
calls. Backend acceptance, mail delivery, Google receipt and attribution require
separate genuine-lead evidence. No production forms/calls are used as smoke tests.

## Primary references

- https://nextjs.org/docs/app/guides/self-hosting
- https://github.com/vercel/next.js/releases/tag/v15.5.28
- https://github.com/vercel/next.js/releases/tag/v15.5.29
- https://docs.digitalocean.com/support/how-do-i-fix-disk-space-issues-on-my-droplet/
- https://services.gehealthcare.com/gehcstorefront/p/5371622-50

Upstream reports of Next memory leaks are investigation leads, not proof that this
site has the same defect. Do not patch framework internals based only on a similar
error message. Archive production evidence before any retention change.
