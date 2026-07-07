"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import {
  montarOperacaoExcecao,
  type OpNegocioRow,
  type OpObraRow,
  type OpPedidoRow,
} from "@/lib/crm/operacao-excecao";

type Brutos = { negocios: OpNegocioRow[]; obras: OpObraRow[]; pedidos: OpPedidoRow[] };
const VAZIO: Brutos = { negocios: [], obras: [], pedidos: [] };

function moeda(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return `R$ ${v.toFixed(0)}`;
}

export function CrmOperacaoExcecao() {
  const [brutos, setBrutos] = useState<Brutos>(VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [agora, setAgora] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch("/api/crm/operacao-excecao", {
        credentials: "include",
        headers: internalApiHeaders(),
      });
      const json = (await res.json().catch(() => ({}))) as { data?: Brutos };
      setBrutos(json.data ?? VAZIO);
    } catch {
      setBrutos(VAZIO);
    } finally {
      setAgora(Date.now());
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
    const ch = supabase
      .channel("crm_operacao_excecao")
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_negocios" }, carregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_obras" }, carregar)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [carregar]);

  const r = useMemo(
    () => montarOperacaoExcecao({ ...brutos, agoraMs: agora ?? 0 }),
    [brutos, agora]
  );

  return (
    <section className="h-full rounded-2xl border border-[#1d3a2c] bg-[#0f1d16] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
      <div className="mb-3 flex items-center gap-3">
        <p className="shrink-0 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8b949e]">
          O que travou · operação
        </p>
        <span className="h-px flex-1 bg-gradient-to-r from-[#1d3a2c] to-transparent" aria-hidden />
      </div>

      {agora == null || carregando ? (
        <div className="space-y-2" aria-hidden>
          <div className="h-12 animate-pulse rounded-xl bg-[#16271e]" />
          <div className="h-12 animate-pulse rounded-xl bg-[#16271e]" />
        </div>
      ) : r.tudoEmDia ? (
        <div className="flex items-center gap-3 rounded-xl border border-[#23863655] bg-[#003b2622] px-4 py-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[#3fb950]" />
          <p className="text-sm leading-snug text-[#e6edf3]">
            Operação em dia <span aria-hidden>✓</span> — nada preso ou atrasado agora.
          </p>
        </div>
      ) : (
        <ul className="m-0 list-none space-y-2 p-0">
          {r.itens.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                className="flex min-h-12 items-center gap-3 rounded-xl border border-[#1d3a2c] bg-[#0a140f]/70 px-3 py-2.5 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-[#c9a24a66]"
                style={{ borderLeftColor: item.cor, borderLeftWidth: 3 }}
              >
                <span
                  className="flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-sm font-black tabular-nums"
                  style={{ background: `${item.cor}22`, color: item.cor }}
                >
                  {item.count}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#e6edf3]">{item.label}</p>
                  <p className="truncate text-[11px] text-[#8b949e]">
                    {item.sub}
                    {item.piorDias != null ? ` · pior: ${item.piorDias}d` : ""}
                  </p>
                </div>
                {item.valor != null && item.valor > 0 && (
                  <span className="shrink-0 text-xs font-bold tabular-nums text-[#c9a24a]">{moeda(item.valor)}</span>
                )}
                <ArrowRight className="h-4 w-4 shrink-0 text-[#484f58]" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
