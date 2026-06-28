"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Preferência de colunas visíveis por lista, persistida em localStorage (por usuário/navegador).
 * Guarda só as colunas OCULTAS — assim novas colunas aparecem por padrão.
 *
 * `defaultOcultas` define um conjunto enxuto inicial: as colunas listadas nascem
 * OCULTAS (opt-in) apenas quando o usuário ainda não salvou preferência. Assim que
 * o usuário mexe no seletor, a escolha dele passa a valer (inclusive ligar as ocultas).
 * "Restaurar" volta para esse default enxuto.
 */
export function useColunasVisiveis(storageKey: string, defaultOcultas?: readonly string[]) {
  const [ocultas, setOcultas] = useState<Set<string>>(() => new Set(defaultOcultas ?? []));
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setOcultas(new Set(JSON.parse(raw) as string[]));
      else setOcultas(new Set(defaultOcultas ?? []));
    } catch {
      setOcultas(new Set(defaultOcultas ?? []));
    }
    setHidratado(true);
    // defaultOcultas é estável (constante de módulo); storageKey identifica a lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const base = new Set(defaultOcultas ?? []);
    setOcultas(base);
    persistir(base);
    // defaultOcultas é estável (constante de módulo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistir]);

  const isVisivel = useCallback((id: string) => !ocultas.has(id), [ocultas]);

  return { isVisivel, alternar, restaurar, ocultas, hidratado };
}
