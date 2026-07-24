"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

let aosPromise;

const loadAos = () => {
  if (!aosPromise) {
    aosPromise = import("aos").then(({ default: AOS }) => {
      AOS.init({
        duration: 800,
        easing: "ease-out",
        once: true,
      });
      return AOS;
    });
  }

  return aosPromise;
};

export default function AosInitializer() {
  const pathname = usePathname();

  useEffect(() => {
    let active = true;
    let frame;

    loadAos().then((AOS) => {
      if (!active) return;
      frame = window.requestAnimationFrame(() => AOS.refreshHard());
    });

    return () => {
      active = false;
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [pathname]);

  return null;
}
