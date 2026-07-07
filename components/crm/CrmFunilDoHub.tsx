"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import {
  montarFunilDoHub,
  type FunilLeadRow,
  type FunilVinculoRow,
  type FunilNegocioRow,
  type FunilObraRow,
  type FunilHubElo,
} from "@/lib/crm/funil-do-hub";

type Brutos = {
  leads: FunilLeadRow[];
  vinculos: FunilVinculoRow[];
  negocios: FunilNegocioRow[];
  obras: FunilObraRow[];
};

const VAZIO: Brutos = { leads: [], vinculos: [], negocios: [], obras: [] };

function moeda(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return `R$ ${v.toFixed(0)}`;
}

const DESTINO: Record<FunilHubElo["key"], string> = {
  captada: "/crm/leads",
  roteada: "/crm/leads?estagio=encaminhado&view=kanban",
  aceita: "/crm/negocios",
  execucao: "/crm/obras",
  paga: "/crm/negocios",
};

export function CrmFunilDoHub() {
  const router = useRouter();
  const [brutos, setBrutos] = useState<Brutos>(VAZIO);
  const [mercado, setMercado] = useState("");
  const [origem, setOrigem] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const res = await fetch("/api/crm/funil-hub", {
        credentials: "include",
        headers: internalApiHeaders(),
      });
      const json = (await res.json().catch(() => ({}))) as { data?: Brutos; error?: string };
      if (!res.ok || !json.data) {
        setErro(json.error || "Falha ao carregar o funil.");
        setBrutos(VAZIO);
        return;
      }
      setBrutos(json.data);
    } catch {
      setErro("Erro de rede.");
      setBrutos(VAZIO);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
    const ch = supabase
      .channel("crm_funil_hub")
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_leads_crm" }, carregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_negocios" }, carregar)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [carregar]);

  const r = useMemo(
    () => montarFunilDoHub({ ...brutos, filtro: { mercado, origem } }),
    [brutos, mercado, origem]
  );

  return (
    <section
      className="rounded-2xl border border-[#1d3a2c] bg-gradient-to-b from-[#0f1d16] to-[#0f1520] shadow-[0_12px_36px_rgba(0,0,0,0.28)]"
      aria-label="Funil do Hub"
    >
      {/* Cabeçalho + filtros (Mercado · Origem) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1d3a2c] px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="m-0 text-sm font-bold text-[#e6edf3]">Funil do Hub</h2>
          <p className="mt-0.5 text-xs text-[#8b949e]">
            Demanda → Roteada → Aceita → Execução → Ganha · a <b className="text-[#c9a24a]">rede</b>, não a venda
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={mercado}
            onChange={(e) => setMercado(e.target.value)}
            className="min-h-9 rounded-lg border border-[#1d3a2c] bg-[#16271e] px-2.5 text-xs font-bold text-[#e6edf3] outline-none focus:border-[#c9a24a]"
            title="Fatiar por mercado"
          >
            <option value="">Todos os mercados</option>
            {r.mercados.map((m) => (
              <option key={m.valor} value={m.valor}>{m.label}</option>
            ))}
          </select>
          <select
            value={origem}
            onChange={(e) => setOrigem(e.target.value)}
            className="min-h-9 rounded-lg border border-[#1d3a2c] bg-[#16271e] px-2.5 text-xs font-bold text-[#e6edf3] outline-none focus:border-[#c9a24a]"
            title="Fatiar por origem (como veio)"
          >
            <option value="">Toda origem</option>
            {r.origens.map((o) => (
              <option key={o.valor} value={o.valor}>{o.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void carregar()}
            title="Atualizar"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#1d3a2c] text-[#8b949e] transition-colors hover:border-[#c9a24a40] hover:text-[#c9a24a]"
          >
            <RefreshCw className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {erro ? (
        <p className="px-5 py-4 text-sm text-[#ff7b72]">{erro}</p>
      ) : (
        <div className="flex items-stretch gap-1 overflow-x-auto px-3 py-4 scrollbar-none sm:px-4">
          {r.elos.map((elo, i) => (
            <div key={elo.key} className="flex items-stretch">
              <button
                type="button"
                onClick={() => router.push(DESTINO[elo.key])}
                className="flex min-w-[8.5rem] flex-1 flex-col rounded-xl border border-[#1d3a2c] bg-[#0a140f]/70 px-3 py-2.5 text-left transition-colors hover:border-[#c9a24a55]"
                style={{ borderTop: `2px solid ${elo.cor}` }}
              >
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#8b949e]">{elo.label}</span>
                <span className="mt-0.5 text-2xl font-black tabular-nums text-[#e6edf3]">{elo.count}</span>
                <span className="text-[11px] font-bold tabular-nums text-[#c9a24a]">{moeda(elo.valor)}</span>
                <span className="mt-0.5 text-[10px] text-[#6e7681]">{elo.sub}</span>
                {elo.pctDaCaptacao != null && (
                  <span className="mt-1 text-[10px] font-bold tabular-nums" style={{ color: elo.cor }}>
                    {elo.pctDaCaptacao}% da captação
                  </span>
                )}
              </button>
              {i < r.elos.length - 1 && (
                <div className="flex items-center px-0.5" aria-hidden>
                  <ChevronRight className="h-4 w-4 text-[#484f58]" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {r.negociosSemLead > 0 && (
        <div className="border-t border-[#1d3a2c] px-4 py-2 text-[11px] text-[#8b949e] sm:px-5">
          <span className="font-bold text-[#c9a24a]">{r.negociosSemLead}</span> negócio(s) sem lead de origem
          (entrada direta / mercado) — fora da coorte, mas nada se perde.
        </div>
      )}
    </section>
  );
}
