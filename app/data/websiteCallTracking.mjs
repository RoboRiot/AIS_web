export const WEBSITE_CALL_DESTINATION = "AW-18384213473/Bg2YCLSJpIAdEOGro75E";
export const BUSINESS_PHONE = "(559) 537-6851";
export const BUSINESS_PHONE_HREF = "tel:+15595376851";

export function normalizeForwardingNumber(formatted, dialable) {
  const digits = String(dialable || "").replace(/^\+/, "");
  if (!/^1\d{10}$/.test(digits)) return null;
  if (String(formatted || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "") !== digits.slice(1)) return null;
  return { text: String(formatted), href: `tel:+${digits}` };
}

// Preserve React's elements, icons, and CTA text; only change number text nodes.
export function createPhoneNumberReplacement(document) {
  const originals = new Map();
  const pattern = /\(559\) 537-6851/g;
  return {
    apply(number) {
      for (const anchor of document.querySelectorAll(`a[href="${BUSINESS_PHONE_HREF}"]`)) {
        const original = originals.get(anchor) || { href: anchor.getAttribute("href"), texts: new Map() };
        const walker = document.createTreeWalker(anchor, 4);
        let node;
        while ((node = walker.nextNode())) {
          if (!node.nodeValue.includes(BUSINESS_PHONE)) continue;
          if (!original.texts.has(node)) original.texts.set(node, node.nodeValue);
          node.nodeValue = node.nodeValue.replace(pattern, number.text);
        }
        originals.set(anchor, original);
        anchor.setAttribute("href", number.href);
      }
      for (const anchor of originals.keys()) if (!anchor.isConnected) originals.delete(anchor);
    },
    restore() {
      for (const [anchor, original] of originals) {
        anchor.setAttribute("href", original.href);
        for (const [node, value] of original.texts) if (node.isConnected) node.nodeValue = value;
      }
      originals.clear();
    },
  };
}
