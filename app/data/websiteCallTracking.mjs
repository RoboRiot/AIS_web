import { BUSINESS_PHONE, BUSINESS_PHONE_HREF, SUPPORT_PHONE_HREF } from "./businessContact.mjs";
export { BUSINESS_PHONE, BUSINESS_PHONE_HREF } from "./businessContact.mjs";

export const WEBSITE_CALL_GTM_EVENT = "ais_call_tracking_ready";
const FORWARDING_ATTRIBUTE = "data-ais-forwarding-href";

export function getPhoneClickMeasurement({ element, consent, tagState } = {}) {
  const href = element?.getAttribute("href") || "";
  const forwardingHref = element?.getAttribute(FORWARDING_ATTRIBUTE);
  return {
    marketing_consent: ["granted", "denied"].includes(consent) ? consent : "unknown",
    google_tag_state: ["loaded", "failed"].includes(tagState) ? tagState : "not_loaded",
    call_number_type: href === BUSINESS_PHONE_HREF ? "business_number" :
      href === SUPPORT_PHONE_HREF ? "existing_customer_number" :
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
  return {
    apply(number) {
      for (const anchor of document.querySelectorAll(
        `a[href="${BUSINESS_PHONE_HREF}"],a[href="${number.href}"],a[href="${number.href.replace("tel:+", "tel:")}"]`
      )) {
        const original = originals.get(anchor) || { href: BUSINESS_PHONE_HREF,
          forwardingHref: null, texts: new Map() };
        const walker = document.createTreeWalker(anchor, 4);
        let node;
        while ((node = walker.nextNode())) {
          if (!node.nodeValue.includes(BUSINESS_PHONE) && !node.nodeValue.includes(number.text)) continue;
          if (!original.texts.has(node)) original.texts.set(node, node.nodeValue.replaceAll(number.text, BUSINESS_PHONE));
          const text = node.nodeValue.replaceAll(BUSINESS_PHONE, number.text);
          if (node.nodeValue !== text) node.nodeValue = text;
        }
        originals.set(anchor, original);
        if (anchor.getAttribute(FORWARDING_ATTRIBUTE) !== number.href) anchor.setAttribute(FORWARDING_ATTRIBUTE, number.href);
        if (anchor.getAttribute("href") !== number.href) anchor.setAttribute("href", number.href);
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

// GTM owns number retrieval. Only synchronize React/mobile CTAs with the number
// GTM puts in a marked site phone link; never request a second conversion label.
export function createGtmPhoneNumberBridge(document) {
  const replacement = createPhoneNumberReplacement(document);
  let number = null;
  return {
    synchronize(allowed) {
      // The desktop header is hidden on mobile. Accept either known source.
      const sources = [...document.querySelectorAll("[data-ais-call-source]")].map((source) => {
        const text = source.textContent?.trim() || "";
        const digits = text.replace(/\D/g, "");
        const candidate = /^1?\d{10}$/.test(digits)
          ? normalizeForwardingNumber(text, digits.length === 10 ? `1${digits}` : digits) : null;
        return { source, candidate };
      });
      const { source, candidate } = sources.find(({ source, candidate }) => candidate &&
        candidate.href !== BUSINESS_PHONE_HREF &&
        [BUSINESS_PHONE_HREF, candidate.href, candidate.href.replace("tel:+", "tel:")].includes(source.getAttribute("href"))) || {};
      if (!allowed) {
        if (candidate && candidate.href !== BUSINESS_PHONE_HREF) replacement.apply(candidate);
        replacement.restore();
        // GTM may have rewritten the header before this component mounted.
        if (candidate && candidate.href !== BUSINESS_PHONE_HREF && source) {
          const walker = document.createTreeWalker(source, 4);
          let node;
          while ((node = walker.nextNode())) {
            if (node.nodeValue.includes(candidate.text)) node.nodeValue = node.nodeValue.replace(candidate.text, BUSINESS_PHONE);
          }
          if (source.getAttribute("href") !== BUSINESS_PHONE_HREF) source.setAttribute("href", BUSINESS_PHONE_HREF);
          source.removeAttribute(FORWARDING_ATTRIBUTE);
        }
        number = null;
        return;
      }
      if (candidate && candidate.href !== BUSINESS_PHONE_HREF &&
          [BUSINESS_PHONE_HREF, candidate.href, candidate.href.replace("tel:+", "tel:")].includes(source.getAttribute("href"))) {
        number = candidate;
        if (source.getAttribute("href") !== number.href) source.setAttribute("href", number.href);
        if (source.getAttribute(FORWARDING_ATTRIBUTE) !== number.href) source.setAttribute(FORWARDING_ATTRIBUTE, number.href);
      }
      if (number) replacement.apply(number);
    },
  };
}
