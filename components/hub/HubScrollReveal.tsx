"use client";

import { useEffect } from "react";

/** Revelação suave ao scroll na landing Hub. */
export function HubScrollReveal() {
  useEffect(() => {
    const nodes = document.querySelectorAll(".hub-reveal, .hub-reveal-delay");
    if (!nodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("hub-visible");
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);

  return null;
}
