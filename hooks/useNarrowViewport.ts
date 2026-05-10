"use client";

import { useLayoutEffect, useState } from "react";

/** Alinha com Tailwind `md:` (768px): mobile = &lt; 768px. */
const QUERY = "(max-width: 767px)";

/**
 * Layout “mobile” (shell inferior, menus compactos). Usa largura da viewport,
 * não só User-Agent — funciona em Android/iOS e ao redimensionar o navegador.
 */
export function useNarrowViewport(): boolean | null {
  const [narrow, setNarrow] = useState<boolean | null>(null);

  useLayoutEffect(() => {
    const mq = window.matchMedia(QUERY);
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return narrow;
}
