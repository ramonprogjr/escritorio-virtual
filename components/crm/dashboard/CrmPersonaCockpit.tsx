"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  AlertOctagon,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  FileCheck2,
  Info,
  KeyRound,
  Package,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { CrmMetricCard, CrmSectionTitle } from "@/components/crm/CrmMetricCard";
import type { PersonaCockpitPayload } from "@/lib/crm/persona-cockpit";

/**
 * Cockpit de uma persona NÃO-comercial (engenharia/arquiteto/cliente/fornecedor).
 * Consome o MESMO endpoint /api/crm/dashboard (persona-aware; a persona vem da SESSÃO no
 * servidor). Renderiza: "O que precisa de você" (topo, por regra) + 3–5 cards acionáveis +
 * avisos de estado-vazio HONESTO (fonte ausente nunca vira zero mudo).
 */

const ICONES: Record<string, LucideIcon> = {
  "alert-triangle": AlertTriangle,
  "alert-octagon": AlertOctagon,
  package: Package,
  "calendar-clock": CalendarClock,
  "file-check": FileCheck2,
  key: KeyRound,
};

type Estado =
  | { fase: "carregando" }
  | { fase: "erro"; msg: string }
  | { fase: "ok"; payload: PersonaCockpitPayload };

export function CrmPersonaCockpit() {
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });

  const carregar = useCallback(async () => {
    setEstado({ fase: "carregando" });
    try {
      const res = await fetch("/api/crm/dashboard", {
        credentials: "include",
        headers: { ...internalApiHeaders() },
      });
      if (!res.ok) {
        setEstado({ fase: "erro", msg: "Não foi possível carregar o painel." });
        return;
      }
      const json = (await res.json()) as { persona?: string; cards?: unknown };
      // Defesa: se (por divergência de papel) vier o payload comercial, orienta o recarregamento
      // em vez de renderizar um cockpit persona vazio.
      if (!json.persona || json.persona === "comercial" || !Array.isArray(json.cards)) {
        setEstado({ fase: "erro", msg: "Seu painel foi atualizado. Recarregue a página." });
        return;
      }
      setEstado({ fase: "ok", payload: json as unknown as PersonaCockpitPayload });
    } catch {
      setEstado({ fase: "erro", msg: "Falha de rede ao carregar o painel." });
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (estado.fase === "carregando") {
    return (
      <div className="min-h-screen bg-[#0a140f] px-4 py-5 sm:px-6 sm:py-6">
        <div className="mx-auto w-full max-w-[1400px] animate-pulse space-y-4">
          <div className="h-6 w-40 rounded bg-[#16271e]" />
          <div className="h-24 rounded-2xl bg-[#0f1d16]" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <div className="h-24 rounded-2xl bg-[#0f1d16]" />
            <div className="h-24 rounded-2xl bg-[#0f1d16]" />
            <div className="h-24 rounded-2xl bg-[#0f1d16]" />
          </div>
        </div>
      </div>
    );
  }

  if (estado.fase === "erro") {
    return (
      <div className="min-h-screen bg-[#0a140f] px-4 py-5 sm:px-6 sm:py-6">
        <div className="mx-auto w-full max-w-[1400px]">
          <div
            className="rounded-2xl border border-[#f8514966] bg-[#1a0a0a] px-4 py-3 text-sm text-[#ff7b72]"
            role="alert"
          >
            {estado.msg}
            <button
              type="button"
              onClick={() => void carregar()}
              className="ml-2 text-xs font-bold underline"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { payload } = estado;

  return (
    <div className="min-h-screen bg-[#0a140f] px-4 py-5 sm:px-6 sm:py-6">
      <div className="mx-auto w-full max-w-[1400px] space-y-6">
        {/* Cabeçalho da persona */}
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#e6edf3]">{payload.titulo}</h1>
          <p className="mt-0.5 text-sm text-[#8b949e]">{payload.subtitulo}</p>
        </div>

        {/* O que precisa de você — topo de toda persona (por regra) */}
        <OQuePrecisa acoes={payload.acoes} />

        {/* Cards acionáveis do recorte */}
        {payload.cards.length > 0 && (
          <div>
            <CrmSectionTitle>Visão geral</CrmSectionTitle>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {payload.cards.map((c) => (
                <CrmMetricCard
                  key={c.id}
                  label={c.label}
                  valor={c.valor}
                  sub={c.sub}
                  cor={c.cor}
                  href={c.href}
                />
              ))}
            </div>
          </div>
        )}

        {/* Avisos de estado-vazio HONESTO (fonte ausente) */}
        {payload.avisos.length > 0 && (
          <div className="space-y-2">
            {payload.avisos.map((a, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-xl border border-dashed border-[#2a4636] bg-[#0c1a10] px-3 py-2.5"
              >
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#8aa99a]" />
                <span className="text-xs leading-relaxed text-[#8aa99a]">{a}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OQuePrecisa({ acoes }: { acoes: PersonaCockpitPayload["acoes"] }) {
  if (acoes.length === 0) {
    return (
      <section className="flex items-center gap-3 rounded-2xl border border-[#23863655] bg-gradient-to-r from-[#003b2622] to-[#0f1d16] px-4 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#23863633]">
          <CheckCircle2 className="h-5 w-5 text-[#3fb950]" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#3fb950]">
            O que precisa de você
          </p>
          <p className="mt-0.5 text-sm leading-snug text-[#e6edf3]">
            Nada exige sua ação agora <span aria-hidden>✓</span>
          </p>
        </div>
      </section>
    );
  }

  const total = acoes.reduce((s, a) => s + a.valor, 0);

  return (
    <section className="rounded-2xl border border-[#c9a24a55] bg-gradient-to-br from-[#1a1508] via-[#0f1d16] to-[#0f1520] p-4 shadow-[0_12px_36px_rgba(0,0,0,0.28)] sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#c9a24a]">
          O que precisa de você
        </p>
        <span className="shrink-0 rounded-full border border-[#c9a24a44] bg-[#c9a24a14] px-2 py-0.5 text-[10px] font-bold text-[#c9a24a]">
          {total} pendente{total === 1 ? "" : "s"}
        </span>
      </div>
      <ul className="m-0 list-none space-y-2 p-0">
        {acoes.map((item) => {
          const Icon = ICONES[item.icone] ?? Sparkles;
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex min-h-12 items-center gap-3 rounded-xl border border-[#1d3a2c] bg-[#0a140f]/80 px-3 py-2.5 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-[#c9a24a66]"
                style={{ borderLeftColor: item.cor, borderLeftWidth: 3 }}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  style={{ background: `${item.cor}22`, color: item.cor }}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[#e6edf3]">
                  {item.label}
                </p>
                <span
                  className="flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold"
                  style={{ background: `${item.cor}1f`, color: item.cor }}
                >
                  {item.cta}
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
