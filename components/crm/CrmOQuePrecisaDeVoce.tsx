"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronDown,
  MessageSquare,
  User,
} from "lucide-react";
import type { ComponentType } from "react";
import type { CrmMetricas, AlertaResumo } from "@/lib/crm/dashboard-aggregate";
import { useLeadsParados } from "@/hooks/useLeadsParados";

/**
 * Painel único "O que precisa de você" — funde Ação agora + Alertas + Leads parados.
 * Agregação 100% por REGRA (contagens reais), sem IA/Mistral. Cada item leva ao job
 * num toque. Reusa: useCrmDashboard (m + alertas) e useLeadsParados (mesmo endpoint).
 */

type Prioridade = "alta" | "media" | "baixa";

type ItemAcao = {
  id: string;
  label: string;
  valor: number;
  href: string;
  cta: string;
  cor: string;
  prioridade: Prioridade;
  Icon: ComponentType<{ className?: string }>;
};

const PESO: Record<Prioridade, number> = { alta: 0, media: 1, baixa: 2 };

export function CrmOQuePrecisaDeVoce({
  m,
  alertas,
  loading,
  indisponivel,
}: {
  m: CrmMetricas;
  alertas: AlertaResumo[];
  loading: boolean;
  /** Painel principal não carregou — evita estado "tudo em dia" enganoso */
  indisponivel?: boolean;
}) {
  const router = useRouter();
  const { leads: parados, loading: loadingParados } = useLeadsParados(8);
  const [aberto, setAberto] = useState(false);

  const paradosUrgentes = useMemo(
    () => parados.filter((l) => (l.dias_parado ?? 0) >= 1),
    [parados]
  );

  const itens = useMemo<ItemAcao[]>(() => {
    const lista: ItemAcao[] = [];

    if (paradosUrgentes.length > 0) {
      const graves = paradosUrgentes.filter((l) => (l.dias_parado ?? 0) >= 7).length;
      lista.push({
        id: "parados",
        label:
          graves > 0
            ? `${paradosUrgentes.length} leads sem resposta · ${graves} há +7 dias`
            : `${paradosUrgentes.length} lead${paradosUrgentes.length === 1 ? "" : "s"} sem resposta há +24h`,
        valor: paradosUrgentes.length,
        href: "/crm/leads",
        cta: "Atender",
        cor: graves > 0 ? "#f85149" : "#f59e0b",
        prioridade: graves > 0 ? "alta" : "media",
        Icon: AlertTriangle,
      });
    }

    if (m.aprovacoesPendentes > 0) {
      lista.push({
        id: "aprovacoes",
        label: `${m.aprovacoesPendentes} aprovaç${m.aprovacoesPendentes === 1 ? "ão pendente" : "ões pendentes"}`,
        valor: m.aprovacoesPendentes,
        href: "/crm/aprovacoes",
        cta: "Revisar",
        cor: "#f85149",
        prioridade: "alta",
        Icon: AlertCircle,
      });
    }

    if (m.leadsAguardando > 0) {
      lista.push({
        id: "aguardando",
        label: `${m.leadsAguardando} lead${m.leadsAguardando === 1 ? "" : "s"} aguardando você`,
        valor: m.leadsAguardando,
        href: "/crm/atendimento",
        cta: "Abrir",
        cor: "#c9a24a",
        prioridade: "media",
        Icon: User,
      });
    }

    if (m.mensagensFilaPendentes > 0) {
      lista.push({
        id: "fila",
        label: `${m.mensagensFilaPendentes} mensage${m.mensagensFilaPendentes === 1 ? "m na fila" : "ns na fila"}`,
        valor: m.mensagensFilaPendentes,
        href: "/crm/atendimento",
        cta: "Responder",
        cor: "#d29922",
        prioridade: "media",
        Icon: MessageSquare,
      });
    }

    if (alertas.length > 0) {
      lista.push({
        id: "alertas",
        label: `${alertas.length} alerta${alertas.length === 1 ? "" : "s"} não lido${alertas.length === 1 ? "" : "s"}`,
        valor: alertas.length,
        href: "/crm/aprovacoes",
        cta: "Ver",
        cor: "#4db3c4",
        prioridade: "baixa",
        Icon: Bell,
      });
    }

    return lista.sort((a, b) => PESO[a.prioridade] - PESO[b.prioridade]);
  }, [paradosUrgentes, m.aprovacoesPendentes, m.leadsAguardando, m.mensagensFilaPendentes, alertas]);

  if (indisponivel) return null;

  const carregando = loading || loadingParados;

  if (carregando) {
    return (
      <section className="mb-6 animate-pulse rounded-2xl border border-[#1d3a2c] bg-[#0f1d16] p-5">
        <div className="h-4 w-44 rounded bg-[#16271e]" />
        <div className="mt-4 space-y-2.5">
          <div className="h-14 rounded-xl bg-[#16271e]" />
          <div className="h-14 rounded-xl bg-[#16271e]" />
        </div>
      </section>
    );
  }

  const totalPendentes = itens.reduce((s, i) => s + i.valor, 0);

  if (itens.length === 0) {
    return (
      <section className="mb-6 flex items-center gap-3 rounded-2xl border border-[#23863655] bg-gradient-to-r from-[#003b2622] to-[#0f1d16] px-4 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#23863633]">
          <CheckCircle2 className="h-5 w-5 text-[#3fb950]" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#3fb950]">
            O que precisa de você
          </p>
          <p className="mt-0.5 text-sm leading-snug text-[#e6edf3]">
            Tudo em dia <span aria-hidden>✓</span> — nada exige sua ação agora.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-2xl border border-[#c9a24a55] bg-gradient-to-br from-[#1a1508] via-[#0f1d16] to-[#0f1520] p-4 shadow-[0_12px_36px_rgba(0,0,0,0.28)] sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#c9a24a]">
          O que precisa de você
        </p>
        <span className="shrink-0 rounded-full border border-[#c9a24a44] bg-[#c9a24a14] px-2 py-0.5 text-[10px] font-bold text-[#c9a24a]">
          {totalPendentes} pendente{totalPendentes === 1 ? "" : "s"}
        </span>
      </div>

      <ul className="m-0 list-none space-y-2 p-0">
        {itens.map((item) => (
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
                <item.Icon className="h-4 w-4" />
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
        ))}
      </ul>

      {paradosUrgentes.length > 0 && (
        <div className="mt-3 border-t border-[#1d3a2c] pt-3">
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            aria-expanded={aberto}
            className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-left text-xs font-bold text-[#8b949e] transition-colors hover:text-[#c9a24a]"
          >
            <span>
              {aberto ? "Ocultar" : "Ver"} leads parados ({paradosUrgentes.length})
            </span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${aberto ? "rotate-180" : ""}`}
            />
          </button>

          {aberto && (
            <ul className="m-0 mt-2 list-none space-y-1 p-0">
              {paradosUrgentes.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/crm/leads/${l.id}`)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl border border-transparent px-2.5 py-2 text-left transition-colors hover:border-[#1d3a2c] hover:bg-[#0f1520]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#e6edf3]">
                        {l.nome || `Lead ${l.id.slice(0, 8)}`}
                      </p>
                      <p className="text-xs text-[#6e7681]">
                        sem próxima ação
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {l.dias_parado != null && (
                        <span
                          className={`text-xs font-bold ${(l.dias_parado ?? 0) >= 7 ? "text-[#f85149]" : "text-[#f59e0b]"}`}
                        >
                          {l.dias_parado}d
                        </span>
                      )}
                      <ArrowRight className="h-4 w-4 text-[#484f58]" />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
