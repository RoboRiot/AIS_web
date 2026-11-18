# Website reliability repair - November 18, 2026

## Memory follow-up and cutover hold

The approved staging run caught an internal-origin regression before cutover:
Node middleware could emit localhost in the Location header for /Parts and
/product-detail. Those same-host redirects now use the canonical production
origin or the validated local/staging host. Relative Location headers are not
accepted by Next's middleware adapter and are not used.
The regression test fails on the prior code, and the HTTP gate now also sends
the production Host and forwarded protocol to the loopback candidate. This
must pass before any application switch. No public traffic was switched during
the failed preflight attempts.

Current rollback baseline, refreshed after the separate tracking deployment:
94deaa7391cc-linux-20261118 at /root/ais-recovery-94deaa7391cc-20261118/app,
PM2 AIS_web_recovery. The older bc39 paths and readings below are historical.

Fresh read-only inspection at 22:03 UTC confirmed the actual Next process is
Node v22.23.4, Next 15.5.27, PID 86022, not the shell's default Node v20.18.2.
It had 307848 KiB RSS and 354432 KiB swap. The PM2 wrapper was still PID 86010
with two restarts. There was no NODE_OPTIONS or memory restart limit. Disk free
remained about 3.2 GB after the approved inactive-cache cleanup; no active files
were removed. No new production changes occurred during this inspection.

Two framework retention defects were reproduced locally on Next 15.5.29:

- After 10000 requests, the Edge timer manager retained 10000 completed timeout
  IDs. The supported `runtime: "nodejs"` middleware avoids this sandbox path.
- The route cache retained 8002 entries while counting only 8033 bytes, omitting
  URL keys and node overhead. The pinned patch backports upstream Next #96229,
  including flat string copies and an 8 MiB byte budget. Both CJS and ESM copies
  are patched. Build and PM2 launch verify normalized SHA-256 hashes so a skipped
  install hook cannot silently undo this fix. CI explicitly applies the patch.

The regression fails against unpatched Next and passes with the backport.
After the changes, 100000 local requests completed (20000 contact-page GETs and
80000 distinct expected 404s, no submissions). Completed sandbox timer count
stayed zero and the route cache plateaued at approximately 8 MiB with eviction.
Local instrumentation used forced GC to measure retained heap; it is never a
production preload. The production crashes prove heap exhaustion, but without
a production heap dump these reproduced defects cannot be claimed to be the
exclusive retained-object cause. Post-release monitoring is still required.

The existing 218 tests, lint, build, 84 sitemap documents / 7983 products,
and the 81-page / 991-resource HTTP release gate passed for the local memory
candidate. These are Windows local results, not Linux deployment evidence.

### Deployment and rollback plan to approve before cutover

1. Build the exact committed candidate on a separate Linux runner using Node
   22.23.4. Do not build on the 1 GB production server. Use only public build
   configuration/catalog inputs; keep production secrets on the server. Verify
   dependency patch hashes, full tests, build, sitemap and artifact checksum.
2. With fresh console authorization, stage the immutable Linux release outside
   the active app, preserve existing environment permissions, and copy missing
   content-hashed static assets from the current release. Verify free disk and
   artifact size before extraction; preserve the complete current app and PM2
   launch metadata privately for rollback. No additional cleanup is implicit.
3. Start a short-lived candidate on loopback port 3001 only if fresh available
   RAM is at least 350 MiB and swap is not pressured; otherwise do not run two
   copies together. Verify candidate identity, redirects, rendered contact and
   trailer pages, sitemaps and assets without sending leads. No production load
   test, heap dump or inspector endpoint.
4. Show the exact staged path, release ID, Node binary and final commands for
   confirmation. During cutover stop the old `AIS_web_badge` wrapper and start
   the candidate directly under PM2 on the existing loopback port 3000. Keep
   nginx routing, TLS, DNS and SSH settings unchanged. Allow a brief restart
   interruption; do not promise zero downtime. The new PM2 config pins Node
   22.23.4, the release, a 480 MiB heap ceiling and 450 MB RSS restart guard.
   A once-per-minute process-only telemetry line records heap/RSS/uptime without
   customer data, request details, forced GC or production inspector exposure.
5. Verify live HTTPS release identity plus the full HTTP and desktop/mobile
   browser gates immediately. Save the new PM2 boot state only after passing.
   Observe actual Node RSS, swap, restarts and error responses after cutover and
   over the following day. A restart guard is backup protection, not the fix.
6. Roll back immediately on startup/identity/route/form-render/asset failure:
   stop the new process, restart the retained old PM2 definition from
   `/root/ais-recovery-94deaa7391cc-20261118/app` on port 3000 with its original
   release/env and verified Node binary, then confirm public old release
   `94deaa7391cc-linux-20261118`. No database migration is involved. Do not delete
   either artifact or change the saved PM2 boot state until service is verified.

The 350 MiB staging threshold was not met at the latest reading (308 MiB).
If it remains below that threshold, hold cutover for approval of a short
stop/start validation window or a separately priced capacity increase; do not
silently resize the Droplet or consume the rollback reserve. Current authority
covers inspection only, not these production writes. Ad budgets remain untouched.

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
