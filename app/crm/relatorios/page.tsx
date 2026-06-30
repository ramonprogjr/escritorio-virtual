"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNarrowViewport } from "@/hooks/useNarrowViewport";
import { RefreshCw } from "lucide-react";
import { CrmStickyPageHeader } from "@/components/crm/CrmStickyPageHeader";
import { useMetricas } from "@/hooks/useMetricas";
import {
  formatarCelulaRelatorio,
  RELATORIO_ENTIDADES_UI,
  RELATORIO_HEADER_LABELS,
  type RelatorioEntidade,
} from "@/lib/crm/relatorios-data";
import { internalApiHeaders } from "@/lib/internal-api-headers";

type LinhaResumo = {
  titulo: string;
  valor: string;
  detalhe: string;
};

type RelatorioJson = {
  entidade: string;
  headers: string[];
  rows: Record<string, unknown>[];
  total: number;
  exibidos?: number;
  truncado?: boolean;
  aviso?: string;
};

export default function Relatorios() {
  const metricas = useMetricas();
  const narrow = useNarrowViewport();
  const [decisoesPendentes, setDecisoesPendentes] = useState(0);
  const [kpisForaMeta, setKpisForaMeta] = useState(0);
  const [entidadeAtiva, setEntidadeAtiva] = useState<RelatorioEntidade>("leads");
  const [dataset, setDataset] = useState<RelatorioJson | null>(null);
  const [tabelaLoading, setTabelaLoading] = useState(true);
  const [tabelaErro, setTabelaErro] = useState<string | null>(null);

  useEffect(() => {
    async function carregarComplementos() {
      // Endpoint server guardado (tenant da sessão + filtro explícito). Substitui a
      // consulta anon direta que dependia só de RLS e podia somar entre tenants.
      try {
        const res = await fetch("/api/crm/relatorios/complementos", { headers: internalApiHeaders() });
        if (!res.ok) return;
        const json = (await res.json()) as { decisoesPendentes?: number; kpisForaMeta?: number };
        setDecisoesPendentes(json.decisoesPendentes ?? 0);
        setKpisForaMeta(json.kpisForaMeta ?? 0);
      } catch {
        // mantém zeros; a tabela principal de relatórios continua funcionando.
      }
    }

    void carregarComplementos();
  }, []);

  const linhasResumo = useMemo<LinhaResumo[]>(
    () => [
      {
        titulo: "Funil de conversão",
        valor: `${metricas.taxaQualificacao}% qualificação`,
        detalhe: `${metricas.leadsHoje} leads hoje; ${metricas.taxaEncaminhamento}% encaminhamento`,
      },
      {
        titulo: "Atendimento",
        valor: `${metricas.mensagensFilaPendentes} mensagens na fila`,
        detalhe: `${metricas.leadsAguardando} leads aguardando ação`,
      },
      {
        titulo: "Receita em risco",
        valor: `R$ ${metricas.receitaPotencial.toLocaleString("pt-BR")}`,
        detalhe: "Soma de oportunidades abertas no CRM",
      },
      {
        titulo: "Rede de parceiros",
        valor: `${metricas.parceirosAtivos} parceiros ativos`,
        detalhe: `${metricas.encaminhamentosHoje} encaminhamentos hoje`,
      },
      {
        titulo: "Auditoria de decisões",
        valor: `${decisoesPendentes} pendentes`,
        detalhe: `${kpisForaMeta} KPIs fora da meta nas últimas 24h`,
      },
    ],
    [decisoesPendentes, kpisForaMeta, metricas]
  );

  const carregarTabela = useCallback(async () => {
    setTabelaLoading(true);
    setTabelaErro(null);
    try {
      const res = await fetch(
        `/api/crm/relatorios/export?entidade=${encodeURIComponent(entidadeAtiva)}&format=json`,
        { credentials: "include", headers: internalApiHeaders() }
      );
      const json = (await res.json().catch(() => ({}))) as RelatorioJson & { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setDataset(json);
    } catch (e) {
      setDataset(null);
      setTabelaErro(e instanceof Error ? e.message : "Erro ao carregar dados");
    } finally {
      setTabelaLoading(false);
    }
  }, [entidadeAtiva]);

  useEffect(() => {
    void carregarTabela();
  }, [carregarTabela]);

  const entidadeLabel =
    RELATORIO_ENTIDADES_UI.find((e) => e.id === entidadeAtiva)?.label ?? entidadeAtiva;

  return (
    <div className="flex min-h-full flex-col bg-[#0a140f]">
      <CrmStickyPageHeader
        title="Relatórios"
        description="Consulta operacional na tela — dados reais do Supabase"
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6">
        <div className="mb-6">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#8b949e]">Resumo operacional</p>
          {metricas.loading ? (
            <p className="text-sm text-[#8b949e]">Carregando métricas…</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {linhasResumo.map((item) => (
                <div key={item.titulo} className="rounded-xl border border-[#1d3a2c] bg-[#0f1d16] p-4">
                  <p className="text-sm font-bold text-[#e6edf3]">{item.titulo}</p>
                  <p className="mt-3 text-2xl font-black text-[#e3b341]">{item.valor}</p>
                  <p className="mt-2 text-xs leading-5 text-[#8b949e]">{item.detalhe}</p>
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-[#6e7681]">Fonte: `/api/crm/metricas`</p>
        </div>

        <div className="rounded-xl border border-[#1d3a2c] bg-[#0f1d16] p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[#e6edf3]">Detalhamento — {entidadeLabel}</p>
              <p className="mt-1 text-xs text-[#8b949e]">
                {dataset
                  ? dataset.truncado
                    ? `${dataset.exibidos ?? dataset.rows.length} de ${dataset.total} registo(s) — exibição limitada a 500`
                    : `${dataset.total} registo(s)`
                  : "Selecione uma aba para ver os dados"}
              </p>
              {dataset?.truncado && dataset.aviso ? (
                <p className="mt-1 text-[11px] font-medium text-[#e3b341]">{dataset.aviso}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => void carregarTabela()}
              disabled={tabelaLoading}
              className="flex items-center gap-1.5 rounded-lg border border-[#1d3a2c] bg-[#16271e] px-3 py-2 text-xs font-bold text-[#e6edf3] hover:bg-[#1d3a2c] disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${tabelaLoading ? "animate-spin" : ""}`} />
              Atualizar
            </button>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {RELATORIO_ENTIDADES_UI.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setEntidadeAtiva(e.id)}
                className="min-h-11 rounded-lg px-3 py-2 text-xs font-bold transition-colors"
                style={{
                  background: entidadeAtiva === e.id ? "#1d3a2c" : "#16271e",
                  color: entidadeAtiva === e.id ? "#e6edf3" : "#8b949e",
                  border: `1px solid ${entidadeAtiva === e.id ? "#c9a24a66" : "#1d3a2c"}`,
                }}
              >
                {e.label}
              </button>
            ))}
          </div>

          {tabelaErro && (
            <div className="mb-4 rounded-lg border border-[#f8514966] bg-[#1a0a0a] px-3 py-3 text-sm text-[#ff7b72]">
              {tabelaErro}
              <button
                type="button"
                onClick={() => void carregarTabela()}
                className="ml-2 text-xs underline"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {!tabelaErro && dataset?.aviso && (
            <div className="mb-4 rounded-lg border border-[#d2992266] bg-[#d2992218] px-3 py-3 text-xs leading-relaxed text-[#e3b341]">
              {dataset.aviso}
            </div>
          )}

          {tabelaLoading ? (
            <p className="py-12 text-center text-sm text-[#8b949e]">Carregando {entidadeLabel.toLowerCase()}…</p>
          ) : dataset && dataset.rows.length === 0 && !dataset.aviso ? (
            <p className="py-12 text-center text-sm text-[#8b949e]">Nenhum registo encontrado.</p>
          ) : dataset && (dataset.rows.length > 0 || dataset.aviso) ? (
            <>
            {/* DESKTOP: tabela padrão — preservada 100% */}
            {narrow !== true && (
              <div className="max-h-[min(70vh,640px)] overflow-auto rounded-lg border border-[#1d3a2c]">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-[#16271e]">
                    <tr className="border-b border-[#1d3a2c] text-[#8b949e]">
                      {dataset.headers.map((h) => (
                        <th key={h} className="whitespace-nowrap px-3 py-2.5 font-bold">
                          {RELATORIO_HEADER_LABELS[h] ?? h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dataset.rows.map((row, ri) => (
                      <tr key={ri} className="border-b border-[#16271e] text-[#e6edf3] hover:bg-[#16271e]/60">
                        {dataset.headers.map((h) => (
                          <td key={h} className="max-w-[220px] truncate whitespace-nowrap px-3 py-2" title={String(row[h] ?? "")}>
                            {formatarCelulaRelatorio(h, row[h])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* MOBILE: cada linha vira um card empilhado (rótulo: valor) */}
            {narrow === true && (
              <div className="flex flex-col gap-3">
                {dataset.rows.map((row, ri) => (
                  <div
                    key={ri}
                    className="rounded-xl border border-[#1d3a2c] bg-[#0f1d16] px-4 py-3"
                  >
                    {dataset.headers.map((h) => {
                      const label = RELATORIO_HEADER_LABELS[h] ?? h;
                      const valor = formatarCelulaRelatorio(h, row[h]);
                      return (
                        <div key={h} className="flex flex-col gap-0.5 border-b border-[#16271e] py-2 last:border-b-0 last:pb-0 first:pt-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#8b949e]">
                            {label}
                          </span>
                          <span className="break-words text-sm text-[#e6edf3]">
                            {valor}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
