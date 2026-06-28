"use client";

import { useEffect, useState } from "react";
import { internalApiHeaders } from "@/lib/internal-api-headers";

export type LeadParado = {
  id: string;
  codigo: string | null;
  nome: string | null;
  estagio: string | null;
  dias_parado: number | null;
};

export type LeadsParadosState = {
  leads: LeadParado[];
  loading: boolean;
};

/**
 * rf-alerta-parado — leads sem próxima ação (parados). Reusa a rota read-only
 * `/api/crm/alertas/parados` (mesma fonte de CrmLeadsParados; não duplica origem).
 */
export function useLeadsParados(limit = 8): LeadsParadosState {
  const [leads, setLeads] = useState<LeadParado[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const res = await fetch(`/api/crm/alertas/parados?limit=${limit}`, {
          headers: internalApiHeaders(),
        });
        const json = (await res.json().catch(() => ({}))) as { data?: LeadParado[] };
        if (vivo && res.ok) setLeads(json.data ?? []);
      } finally {
        if (vivo) setLoading(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [limit]);

  return { leads, loading };
}
