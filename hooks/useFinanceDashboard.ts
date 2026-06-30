"use client";

import { useCallback, useEffect, useState } from "react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import type { FinanceDashboardPayload } from "@/lib/crm/finance-dashboard-aggregate";

export type FinanceDashboardState = FinanceDashboardPayload & {
  loading: boolean;
  erro: string | null;
  carregado: boolean;
  recarregar: () => void;
};

const inicial: FinanceDashboardState = {
  kpis: {
    aPagarAberto: 0,
    aReceberAberto: 0,
    vencidoTotal: 0,
    vencidoPagar: 0,
    vencidoReceber: 0,
    saldoProjetado: 0,
    vence7dTotal: 0,
    vence7dCount: 0,
  },
  acao: [],
  aprovacoes: [],
  pipeline: {
    receitaPotencialLeads: 0,
    receitaPotencialNegocios: 0,
    negociosSitDown: 0,
  },
  proximosVencimentos: [],
  loading: true,
  erro: null,
  carregado: false,
  recarregar: () => {},
};

export function useFinanceDashboard(): FinanceDashboardState {
  const [state, setState] = useState<FinanceDashboardState>(inicial);

  const carregar = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, erro: null }));
    try {
      const res = await fetch("/api/crm/financeiro/dashboard", {
        headers: internalApiHeaders(),
        credentials: "include",
        cache: "no-store",
      });
      if (res.ok) {
        const body = (await res.json()) as FinanceDashboardPayload;
        setState({
          ...body,
          loading: false,
          erro: null,
          carregado: true,
          recarregar: carregar,
        });
        return;
      }
      const errBody = await res.json().catch(() => ({}));
      const errMsg =
        typeof errBody.error === "string" ? errBody.error : `Erro ${res.status}`;
      // Fallback via Supabase client removido (D-3): usava tenant fixo via anon key,
      // ignorava o tenant do usuário logado e dependia de RLS incerta para não vazar.
      // Em falha da rota, exibe erro e permite "Tentar novamente" explicitamente.
      setState((s) => ({
        ...s,
        loading: false,
        erro: errMsg,
        carregado: false,
        recarregar: carregar,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        erro:
          err instanceof Error
            ? err.message
            : "Não foi possível carregar o painel financeiro",
        carregado: false,
        recarregar: carregar,
      }));
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return { ...state, recarregar: carregar };
}
