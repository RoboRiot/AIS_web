// Observed historical URLs, reconciled with exact current catalog identities.
// Evidence and deliberately unresolved URLs: docs/legacy-url-repairs-2026-10-26.md.
export const verifiedLegacyProductRoutes = [
  ["proportioal-valve-assy-positoning-gt-5127284-4", "39abd5a86486", "5127284-4", "GE"],
  ["vdip64-pwa-vct-only-2382000", "e90a062096a7", "2382000", "GE"],
  ["encoder-cradle-danaher-2342727-3", "642eb1a8d389", "2342727-3", "GE"],
  ["long-drive-motor-mg3-a7-46-282360p1", "9f27cda675d8", "46-282360P1", "GE"],
  ["h-power-ac-elevation-motor-emc2-2342733-2", "dbba0432b7f6", "2342733-2", "GE"],
  ["hv-tank-hemit-jedi-2237336-2", "9656307e6cff", "2237336-2", "GE"],
  ["1-5t-hd-4ch-breast-coil-with-cable-5145567-2", "SCF3CFB5F1B321", "5145567-2", "GE"],
  ["absolute-encoder-multi-turnemc-2-2342726-2", "e7a82c6ba78a", "2342726-2", "GE"],
  ["gcifm-pwb-px77-99455", "cb3563dde7c4", "PX77-99455", "TOSHIBA"],
].map(([slug, id, partNumber, oem]) => ({ slug, id, partNumber, oem }));
