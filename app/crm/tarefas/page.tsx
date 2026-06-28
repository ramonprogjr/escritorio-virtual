"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Phone, MessageCircle, ExternalLink, Check, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { CrmStickyPageHeader } from "@/components/crm/CrmStickyPageHeader";
import { patchLeadCrm } from "@/lib/crm/patch-lead-client";

// ─── Types ──────────────────────────────────────────────────────────────────

type AcaoLead = {
  id: string;
  nome: string;
  telefone: string | null;
  estagio: string;
  proxima_acao: string;
  data_proxima_acao: string | null;
  agente_responsavel: string | null;
  humano_responsavel: string | null;
};

type Faixa = "atrasadas" | "hoje" | "proximas";

// ─── Constants ──────────────────────────────────────────────────────────────

/** Estágios "encerrados" — não geram ação pendente mesmo se tiverem texto antigo. */
const ESTAGIOS_ENCERRADOS = new Set([
  "ganho",
  "perdido",
  "spam_invalido",
  "convertido_negocio",
]);

const FAIXAS: Record<Faixa, { label: string; sub: string; cor: string }> = {
  atrasadas: { label: "Atrasadas", sub: "venceram — resolva já", cor: "#f85149" },
  hoje: { label: "Hoje", sub: "para hoje", cor: "#c9a24a" },
  proximas: { label: "Próximas", sub: "agendadas", cor: "#2f9e8f" },
};

const ORDEM_FAIXAS: Faixa[] = ["atrasadas", "hoje", "proximas"];

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Início do dia local em ms — base para classificar vencimento. */
function inicioDoDia(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function classificarFaixa(dataIso: string | null): Faixa {
  if (!dataIso) return "proximas";
  const t = new Date(dataIso).getTime();
  if (Number.isNaN(t)) return "proximas";
  const hoje0 = inicioDoDia(new Date());
  const amanha0 = hoje0 + 86_400_000;
  if (t < hoje0) return "atrasadas";
  if (t < amanha0) return "hoje";
  return "proximas";
}

/** Texto humano do "quando". */
function quando(dataIso: string | null): string {
  if (!dataIso) return "sem data";
  const data = new Date(dataIso);
  if (Number.isNaN(data.getTime())) return "sem data";
  const hoje0 = inicioDoDia(new Date());
  const alvo0 = inicioDoDia(data);
  const dias = Math.round((alvo0 - hoje0) / 86_400_000);
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias === -1) return "ontem";
  if (dias < 0) return `há ${Math.abs(dias)} dias`;
  if (dias < 7) return `em ${dias} dias`;
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function soDigitos(tel: string | null): string {
  return (tel || "").replace(/\D/g, "");
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ProximasAcoesPage() {
  const [acoes, setAcoes] = useState<AcaoLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [concluindo, setConcluindo] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const { data, error } = await supabase
        .from("vw_hub_leads_crm_enriquecido")
        .select(
          "id, nome, telefone, estagio, proxima_acao, data_proxima_acao, agente_responsavel, humano_responsavel"
        )
        .not("proxima_acao", "is", null)
        .order("data_proxima_acao", { ascending: true, nullsFirst: false });

      if (error) {
        setErro("Não foi possível carregar as próximas ações.");
        setAcoes([]);
        return;
      }

      const rows = (data || []) as Record<string, unknown>[];
      const lista: AcaoLead[] = rows
        .map((r) => ({
          id: r.id != null ? String(r.id) : "",
          nome: r.nome != null ? String(r.nome) : "Sem nome",
          telefone: r.telefone != null ? String(r.telefone) : null,
          estagio: r.estagio != null ? String(r.estagio) : "",
          proxima_acao: r.proxima_acao != null ? String(r.proxima_acao).trim() : "",
          data_proxima_acao: r.data_proxima_acao != null ? String(r.data_proxima_acao) : null,
          agente_responsavel: r.agente_responsavel != null ? String(r.agente_responsavel) : null,
          humano_responsavel: r.humano_responsavel != null ? String(r.humano_responsavel) : null,
        }))
        .filter((a) => a.id && a.proxima_acao && !ESTAGIOS_ENCERRADOS.has(a.estagio));

      setAcoes(lista);
    } catch {
      setErro("Erro de rede ao carregar próximas ações.");
      setAcoes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Realtime: leads mudam → recarrega (mesma tabela que alimenta a view).
  useEffect(() => {
    const ch = supabase
      .channel("proximas_acoes_rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hub_leads_crm" },
        () => void carregar()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [carregar]);

  // "Marcar feito" — limpa proxima_acao/data_proxima_acao pelo caminho seguro já existente.
  const marcarFeito = useCallback(
    async (id: string) => {
      setConcluindo(id);
      // Otimista: some da lista na hora.
      const anterior = acoes;
      setAcoes((prev) => prev.filter((a) => a.id !== id));
      const res = await patchLeadCrm(id, {
        proxima_acao: null,
        data_proxima_acao: null,
      });
      if (!res.ok) {
        // Reverte e informa.
        setAcoes(anterior);
        setErro(res.error || "Não foi possível concluir a ação.");
        window.setTimeout(() => setErro(""), 5000);
      }
      setConcluindo(null);
    },
    [acoes]
  );

  const faixas = useMemo(() => {
    const g: Record<Faixa, AcaoLead[]> = { atrasadas: [], hoje: [], proximas: [] };
    for (const a of acoes) g[classificarFaixa(a.data_proxima_acao)].push(a);
    const ordenar = (arr: AcaoLead[]) =>
      arr.sort((x, y) => {
        const tx = x.data_proxima_acao ? new Date(x.data_proxima_acao).getTime() : Infinity;
        const ty = y.data_proxima_acao ? new Date(y.data_proxima_acao).getTime() : Infinity;
        return tx - ty;
      });
    ordenar(g.atrasadas);
    ordenar(g.hoje);
    ordenar(g.proximas);
    return g;
  }, [acoes]);

  const total = acoes.length;
  const vazio = !loading && !erro && total === 0;

  return (
    <div style={{ minHeight: "100%", background: "#0a140f", color: "#e6edf3" }}>
      <CrmStickyPageHeader
        title="Próximas ações"
        description="O que precisa da sua atenção — vencidas e agendadas em um só lugar"
        actions={
          <button
            type="button"
            onClick={() => void carregar()}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#1d3a2c] bg-[#16271e] px-3 py-2 text-xs font-bold text-[#8b949e] transition-colors hover:text-[#e6edf3]"
          >
            <RefreshCw size={13} strokeWidth={2.4} aria-hidden />
            Atualizar
          </button>
        }
      />

      <div className="mx-auto w-full max-w-3xl px-3 pb-24 pt-4 sm:px-5">
        {erro && (
          <div
            role="alert"
            className="mb-3 rounded-xl border border-[#f85149]/40 bg-[#f85149]/10 px-3 py-2.5 text-sm font-semibold text-[#ff7b72]"
          >
            {erro}
          </div>
        )}

        {loading ? (
          <p className="py-12 text-center text-sm text-[#8b949e]">Carregando próximas ações…</p>
        ) : vazio ? (
          <div className="flex flex-col items-center gap-2 py-20 text-center">
            <span className="text-4xl" aria-hidden>
              🎉
            </span>
            <p className="text-sm font-bold text-[#e6edf3]">Nenhuma ação pendente</p>
            <p className="max-w-xs text-xs text-[#8b949e]">
              Tudo em dia. Quando a IA ou você definir uma próxima ação em um lead, ela aparece aqui.
            </p>
            <Link
              href="/crm/leads"
              className="mt-2 inline-flex min-h-10 items-center rounded-lg bg-[#003b26] px-4 py-2 text-sm font-bold text-[#c9a24a] transition-colors hover:brightness-110"
            >
              Ir para os leads
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {ORDEM_FAIXAS.map((faixa) => {
              const itens = faixas[faixa];
              if (itens.length === 0) return null;
              const meta = FAIXAS[faixa];
              return (
                <section key={faixa}>
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: meta.cor }}
                      aria-hidden
                    />
                    <h2 className="text-sm font-bold text-[#e6edf3]">{meta.label}</h2>
                    <span className="text-xs text-[#8b949e]">{meta.sub}</span>
                    <span
                      className="ml-auto rounded-full px-2 py-0.5 text-xs font-bold"
                      style={{ background: meta.cor + "22", color: meta.cor }}
                    >
                      {itens.length}
                    </span>
                  </div>

                  <ul className="space-y-2.5">
                    {itens.map((acao) => {
                      const tel = soDigitos(acao.telefone);
                      const resp = acao.humano_responsavel || acao.agente_responsavel;
                      const ehIA = !acao.humano_responsavel && !!acao.agente_responsavel;
                      return (
                        <li key={acao.id}>
                          <div
                            className="flex flex-col rounded-xl border border-[#1d3a2c] bg-[#0f1d16] p-3.5 transition-colors hover:border-[#2f9e8f]/45"
                            style={{ borderLeftWidth: 3, borderLeftColor: meta.cor }}
                          >
                            {/* Cabeçalho do card: contato + quando */}
                            <div className="flex items-start justify-between gap-2">
                              <Link
                                href={`/crm/leads/${acao.id}`}
                                className="min-w-0 flex-1 truncate text-sm font-bold text-[#e6edf3] hover:text-[#c9a24a]"
                              >
                                {acao.nome}
                              </Link>
                              <span
                                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                                style={{ background: meta.cor + "22", color: meta.cor }}
                              >
                                {quando(acao.data_proxima_acao)}
                              </span>
                            </div>

                            {/* O que fazer */}
                            <p className="mt-1.5 text-[13px] leading-snug text-[#c9d4cd]">
                              {acao.proxima_acao}
                            </p>

                            {/* Responsável */}
                            {resp && (
                              <p className="mt-1 text-[11px]" style={{ color: ehIA ? "#7dd3c8" : "#3fb950" }}>
                                {ehIA ? "IA" : "Você"} · {resp}
                              </p>
                            )}

                            {/* Ações em 1 toque */}
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {tel && (
                                <a
                                  href={`tel:${tel}`}
                                  className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#1d3a2c] bg-[#16271e] px-2.5 py-1.5 text-xs font-bold text-[#b58a63] transition-colors hover:border-[#b58a63]/50"
                                >
                                  <Phone size={13} strokeWidth={2.2} aria-hidden />
                                  Ligar
                                </a>
                              )}
                              {tel && (
                                <a
                                  href={`https://wa.me/55${tel}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#25D366]/15 px-2.5 py-1.5 text-xs font-bold text-[#25D366] transition-colors hover:bg-[#25D366]/25"
                                >
                                  <MessageCircle size={13} strokeWidth={2.2} aria-hidden />
                                  WhatsApp
                                </a>
                              )}
                              <Link
                                href={`/crm/leads/${acao.id}`}
                                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[#1d3a2c] px-2.5 py-1.5 text-xs font-bold text-[#8b949e] transition-colors hover:text-[#e6edf3]"
                              >
                                <ExternalLink size={13} strokeWidth={2.2} aria-hidden />
                                Abrir
                              </Link>
                              <button
                                type="button"
                                onClick={() => void marcarFeito(acao.id)}
                                disabled={concluindo === acao.id}
                                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[#2f9e8f]/40 bg-[#2f9e8f]/12 px-2.5 py-1.5 text-xs font-bold text-[#2f9e8f] transition-colors hover:bg-[#2f9e8f]/22 disabled:opacity-40"
                              >
                                <Check size={13} strokeWidth={2.6} aria-hidden />
                                {concluindo === acao.id ? "…" : "Feito"}
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
