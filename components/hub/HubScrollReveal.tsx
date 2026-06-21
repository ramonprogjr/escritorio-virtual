"use client";

import { useEffect } from "react";

function revelarNoViewport(nodes: NodeListOf<Element>) {
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
  return observer;
}

function revelarPorHash(hash: string) {
  const id = hash.replace(/^#/, "");
  if (!id) return;

  const target = document.getElementById(id);
  if (target) {
    target.classList.add("hub-visible");
    target.querySelectorAll(".hub-reveal, .hub-reveal-delay").forEach((el) => {
      el.classList.add("hub-visible");
    });
  }

  document.querySelectorAll(".hub-reveal, .hub-reveal-delay").forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.85) {
      el.classList.add("hub-visible");
    }
  });
}

/** Revelação suave ao scroll na landing Hub. */
export function HubScrollReveal() {
  useEffect(() => {
    const nodes = document.querySelectorAll(".hub-reveal, .hub-reveal-delay");
    if (!nodes.length) return;

    if (window.location.hash) {
      revelarPorHash(window.location.hash);
    }

    const observer = revelarNoViewport(nodes);

    const onHashChange = () => {
      if (window.location.hash) revelarPorHash(window.location.hash);
    };
    window.addEventListener("hashchange", onHashChange);

    return () => {
      observer.disconnect();
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  return null;
}
