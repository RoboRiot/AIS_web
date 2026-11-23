'use strict';
// Build-only public snapshot. Never packaged or enabled in the server runtime.
const fs = require('node:fs');
const assert = require('node:assert/strict');
assert.equal(process.env.AIS_BUILD_PUBLIC_SITEMAP_SEED, '1');
const rows = JSON.parse(fs.readFileSync(process.env.AIS_SITEMAP_ENTRIES, 'utf8'));
assert.equal(rows.length, 7983);
assert(rows.every(row => row.url.startsWith('https://advancedimagingparts.com/products/') &&
  Object.keys(row).every(key => ['url', 'lastModified'].includes(key))));
const entries = Object.freeze(rows.map(Object.freeze));
globalThis[Symbol.for('ais.product-sitemap-cache.v2')] = async () => entries;

