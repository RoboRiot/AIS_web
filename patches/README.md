# Next.js 15 runtime memory backport

`next+15.5.29.patch` adapts the MIT-licensed Next.js upstream fix:
https://github.com/vercel/next.js/pull/96229

It passes cache keys to size accounting, includes URL length and per-entry overhead
in the filesystem cache's 8 MiB budget, and flattens stored pathname strings so
they do not retain full request URLs. Both CommonJS and ESM runtime copies are
patched. Route resolution, redirect destinations and authentication are unchanged.
Next.js's package license remains in `node_modules/next/license.md`.

The other reproduced retention path is avoided with the supported Node.js
middleware runtime, rather than modifying the Edge timer manager:
https://github.com/vercel/next.js/pull/96161
https://nextjs.org/docs/15/app/api-reference/file-conventions/middleware#runtime

`npm ci` applies the pinned patch. CI, the build command and PM2 launch guard
verify it. Never bypass a failed patch/hash check: review the upstream fix and
update or remove the backport deliberately when upgrading Next. These patches
address reproduced defects, not a guarantee against every future memory leak.
