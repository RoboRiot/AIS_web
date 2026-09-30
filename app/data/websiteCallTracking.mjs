export const WEBSITE_CALL_DESTINATION = "AW-18384213473/Bg2YCLSJpIAdEOGro75E";
export const BUSINESS_PHONE = "(559) 537-6851";
export const BUSINESS_PHONE_HREF = "tel:+15595376851";
const FORWARDING_ATTRIBUTE = "data-ais-forwarding-href";

export function getPhoneClickMeasurement({ element, consent, tagState } = {}) {
  const href = element?.getAttribute("href") || "";
  const forwardingHref = element?.getAttribute(FORWARDING_ATTRIBUTE);
  return {
    marketing_consent: ["granted", "denied"].includes(consent) ? consent : "unknown",
    google_tag_state: ["loaded", "failed"].includes(tagState) ? tagState : "not_loaded",
    call_number_type: href === BUSINESS_PHONE_HREF ? "business_number" :
      forwardingHref === href && /^tel:\+1\d{10}$/.test(href) ? "google_forwarding" : "other",
  };
}

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
        const original = originals.get(anchor) || { href: anchor.getAttribute("href"),
          forwardingHref: anchor.getAttribute(FORWARDING_ATTRIBUTE), texts: new Map() };
        const walker = document.createTreeWalker(anchor, 4);
        let node;
        while ((node = walker.nextNode())) {
          if (!node.nodeValue.includes(BUSINESS_PHONE)) continue;
          if (!original.texts.has(node)) original.texts.set(node, node.nodeValue);
          node.nodeValue = node.nodeValue.replace(pattern, number.text);
        }
        originals.set(anchor, original);
        anchor.setAttribute(FORWARDING_ATTRIBUTE, number.href);
        anchor.setAttribute("href", number.href);
      }
      for (const anchor of originals.keys()) if (!anchor.isConnected) originals.delete(anchor);
    },
    restore() {
      for (const [anchor, original] of originals) {
        anchor.setAttribute("href", original.href);
        if (original.forwardingHref === null) anchor.removeAttribute(FORWARDING_ATTRIBUTE);
        else anchor.setAttribute(FORWARDING_ATTRIBUTE, original.forwardingHref);
        for (const [node, value] of original.texts) if (node.isConnected) node.nodeValue = value;
      }
      originals.clear();
    },
  };
}
