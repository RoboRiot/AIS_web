// These old names represented multiple distinct items, not interchangeable parts.
export const legacyProductGroups = {
  "opconta-px79": {
    title: "Toshiba OPCONTA Boards",
    description: "Compare OPCONTA part numbers for Toshiba Aquilion systems. Confirm the full number and board revision before requesting a quote.",
    members: [
      { id: "4cf8a4850db0", partNumber: "PX79-11179" },
      { id: "c001d5ead5cc", partNumber: "PX79-08650" },
    ],
  },
  "mrc-rot-gs": {
    title: "Philips MRC ROT-GS Tubes",
    description: "MRC ROT-GS identifies a family of Philips X-ray tubes. Match the complete tube part number and installed system; these listings are not interchangeable.",
    members: [
      { id: "temp-218", partNumber: "9890-000-85103" },
      { id: "temp-219", partNumber: "9890-000-85142" },
    ],
  },
};

export const matchesLegacyGroupMember = (member, product, partNumbers) =>
  Boolean(product && member.id === String(product.id) && partNumbers.includes(member.partNumber));
