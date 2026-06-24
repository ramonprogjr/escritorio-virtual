"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Preferência de colunas visíveis por lista, persistida em localStorage (por usuário/navegador).
 * Guarda só as colunas OCULTAS — assim novas colunas aparecem por padrão.
 */
export function useColunasVisiveis(storageKey: string) {
  const [ocultas, setOcultas] = useState<Set<string>>(new Set());
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setOcultas(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* ignore */
    }
    setHidratado(true);
  }, [storageKey]);

  const persistir = useCallback(
    (s: Set<string>) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify([...s]));
      } catch {
        /* ignore */
      }
    },
    [storageKey]
  );

  const alternar = useCallback(
    (id: string) => {
      setOcultas((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        persistir(next);
        return next;
      });
    },
    [persistir]
  );

  const restaurar = useCallback(() => {
    setOcultas(new Set());
    persistir(new Set());
  }, [persistir]);

  const isVisivel = useCallback((id: string) => !ocultas.has(id), [ocultas]);

  return { isVisivel, alternar, restaurar, ocultas, hidratado };
}
