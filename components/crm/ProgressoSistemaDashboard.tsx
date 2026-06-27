"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { crmApiHeaders } from "@/lib/internal-api-headers-client";
import type { RelatorioDiarioPayload } from "@/lib/crm/relatorio-diario-aggregate";
import {
  PROGRESSO_BLOCOS,
  PROGRESSO_FASES,
  PROGRESSO_SISTEMA_REVISAO,
  DEPLOY_CHECKLIST,
  CADEIA_VALOR,
  getBlocoIdPorItem,
  getFaseInfo,
  type ProgressoFase,
  type ProgressoItem,
  type ProgressoPrioridade,
  type ProgressoStatus,
} from "@/lib/crm/progresso-sistema-data";
import {
  computeProgressoStats,
  getProximosPassos,
  getBlocoPct,
  getFunilLeadViz,
  getMercadosViz,
  getDeployStats,
  getItensAbertosPorFase,
  getItensPorFase,
  faseAnteriorComP0Aberto,
  countP0AbertoFase,
  mergeProgressoItens,
  getProgressoVerificacaoMeta,
  type ProgressoItemMerged,
} from "@/lib/crm/progresso-sistema-runtime";

const STATUS_LABEL: Record<ProgressoStatus, string> = {
  ok: "OK",
  parcial: "Parcial",
  gap: "Gap",
  legado: "Legado",
};

const STATUS_COLOR: Record<ProgressoStatus, { bg: string; text: string; border: string; dot: string }> = {
  ok: { bg: "#22c55e18", text: "#3fb950", border: "#22c55e44", dot: "#22c55e" },
  parcial: { bg: "#f59e0b18", text: "#d29922", border: "#f59e0b44", dot: "#f59e0b" },
  gap: { bg: "#ef444418", text: "#f87171", border: "#ef444444", dot: "#ef4444" },
  legado: { bg: "#6b728018", text: "#8b949e", border: "#6b728044", dot: "#6b7280" },
};

function StatusBadge({ status }: { status: ProgressoStatus }) {
  const c = STATUS_COLOR[status];
  return (
    <span
      className="inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{ background: c.bg, color: c.text, borderColor: c.border }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "#1d3a2c", background: "#0f1d16" }}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#8b949e]">{label}</p>
      <p className="mt-1 text-3xl font-bold" style={{ color: accent ?? "#e6edf3" }}>
        {value}
      </p>
      {sub ? <p className="mt-1 text-xs text-[#8b949e]">{sub}</p> : null}
    </div>
  );
}

function ItemRow({ item }: { item: ProgressoItemMerged }) {
  const highlight = item.oQueFalta !== "—";
  const merged = item as ProgressoItemMerged;
  const failedChecks = merged.verificacao?.filter((c) => !c.ok) ?? [];
  return (
    <tr
      className="border-t border-[#1d3a2c] hover:bg-[#0f1d16]"
      style={highlight ? { borderLeft: "2px solid #c9a24a55" } : undefined}
    >
      <td className="px-3 py-2.5 align-top">
        <p className="text-[13px] font-medium text-[#e6edf3]">{item.titulo}</p>
        <p className="mt-0.5 font-mono text-[10px] text-[#6e7681]">{item.pdfRef}</p>
        {failedChecks.length > 0 ? (
          <details className="mt-1">
            <summary className="cursor-pointer text-[10px] text-[#58a6ff]">
              {failedChecks.length} evidência(s) pendente(s)
            </summary>
            <ul className="mt-1 space-y-0.5 text-[10px] text-[#8b949e]">
              {merged.verificacao?.map((c) => (
                <li key={c.id} style={{ color: c.ok ? "#3fb950" : "#f87171" }}>
                  {c.ok ? "✓" : "✗"} {c.id}: {c.detail}
                </li>
              ))}
            </ul>
          </details>
        ) : merged.verificacao && merged.verificacao.length > 0 ? (
          <p className="mt-1 text-[10px] text-[#3fb950]">Verificado no deploy ({merged.verificacao.length} checks)</p>
        ) : null}
      </td>
      <td className="px-3 py-2.5 align-top text-xs text-[#8b949e]">{item.oQueTemos}</td>
      <td className="px-3 py-2.5 align-top text-xs" style={{ color: highlight ? "#e6edf3" : "#8b949e" }}>
        {item.oQueFalta}
      </td>
      <td className="px-3 py-2.5 align-top">
        <StatusBadge status={item.status} />
      </td>
      <td className="px-3 py-2.5 align-top text-xs font-mono text-[#8b949e]">{item.fase}</td>
      <td className="px-3 py-2.5 align-top text-xs font-bold text-[#c9a24a]">{item.prioridade}</td>
      <td className="px-3 py-2.5 align-top">
        <div className="flex flex-col gap-1">
          {item.rota ? (
            <Link href={item.rota} className="text-xs text-[#58a6ff] hover:underline">
              Abrir tela
            </Link>
          ) : null}
          {item.codigo ? (
            <span className="font-mono text-[10px] text-[#6e7681]" title={item.codigo}>
              {item.codigo.split("/").slice(-2).join("/")}
            </span>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function ProximoPassoCard({ item }: { item: ProgressoItem }) {
  return (
    <div
      className="rounded-lg border px-3 py-2.5"
      style={{ borderColor: "#1d3a2c", background: "#0a140f" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-[#e6edf3]">{item.titulo}</p>
        <div className="flex shrink-0 gap-1.5">
          <StatusBadge status={item.status} />
          <span className="rounded border px-1.5 py-0.5 text-[10px] font-bold text-[#c9a24a]" style={{ borderColor: "#c9a24a44" }}>
            {item.fase}
          </span>
        </div>
      </div>
      <p className="mt-1.5 text-xs text-[#8b949e]">{item.oQueFalta}</p>
      {item.rota ? (
        <Link href={item.rota} className="mt-2 inline-block text-xs text-[#58a6ff] hover:underline">
          Abrir tela →
        </Link>
      ) : null}
    </div>
  );
}

function FaseDetalhePanel({
  fase,
  onFechar,
  onVerItemNaMatriz,
  onVerTodosNaMatriz,
  onExpandirFase,
}: {
  fase: ProgressoFase;
  onFechar: () => void;
  onVerItemNaMatriz: (item: ProgressoItem) => void;
  onVerTodosNaMatriz: () => void;
  onExpandirFase: (fase: ProgressoFase) => void;
}) {
  const info = getFaseInfo(fase);
  const abertos = useMemo(() => getItensAbertosPorFase(fase), [fase]);
  const todos = useMemo(() => getItensPorFase(fase), [fase]);
  const okItens = useMemo(() => todos.filter((i) => i.status === "ok"), [todos]);
  const fasePrev = useMemo(() => faseAnteriorComP0Aberto(fase), [fase]);
  const p0Prev = fasePrev ? countP0AbertoFase(fasePrev) : 0;
  const [okVisivel, setOkVisivel] = useState(false);

  return (
    <div
      className="mt-3 rounded-xl border p-4"
      style={{ borderColor: "#c9a24a55", background: "#0a140f" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-[#c9a24a]">
            {fase} — {info?.label ?? fase}
          </h3>
          {info?.periodo ? <p className="mt-0.5 text-[10px] text-[#6e7681]">{info.periodo}</p> : null}
        </div>
        <button
          type="button"
          onClick={onFechar}
          className="rounded-lg border px-3 py-1.5 text-xs text-[#8b949e] hover:text-[#e6edf3]"
          style={{ borderColor: "#1d3a2c" }}
        >
          Fechar
        </button>
      </div>

      {info?.escopo ? (
        <p className="mt-3 text-xs text-[#8b949e]">
          <strong className="text-[#e6edf3]">Escopo:</strong> {info.escopo}
        </p>
      ) : null}

      {fasePrev ? (
        <p className="mt-3 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: "#f59e0b44", background: "#f59e0b12", color: "#d29922" }}>
          Conclua antes:{" "}
          <button
            type="button"
            onClick={() => onExpandirFase(fasePrev)}
            className="font-bold underline hover:text-[#e6edf3]"
          >
            {fasePrev}
          </button>{" "}
          tem {p0Prev} {p0Prev === 1 ? "item P0" : "itens P0"} em aberto
        </p>
      ) : null}

      {abertos.length === 0 ? (
        <p className="mt-4 text-sm font-medium text-[#3fb950]">Fase concluída — nenhum gap ou parcial pendente.</p>
      ) : (
        <>
          <p className="mt-4 text-xs font-bold uppercase tracking-wider text-[#8b949e]">
            Em aberto ({abertos.length})
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-[#6e7681]">
                  <th className="px-2 py-1.5">Requisito</th>
                  <th className="px-2 py-1.5">Status</th>
                  <th className="px-2 py-1.5">Prio</th>
                  <th className="px-2 py-1.5">O que falta</th>
                  <th className="px-2 py-1.5">Ações</th>
                </tr>
              </thead>
              <tbody>
                {abertos.map((item) => (
                  <tr key={item.id} className="border-t border-[#1d3a2c]">
                    <td className="px-2 py-2 align-top text-[#e6edf3]">{item.titulo}</td>
                    <td className="px-2 py-2 align-top">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-2 py-2 align-top font-bold text-[#c9a24a]">{item.prioridade}</td>
                    <td className="px-2 py-2 align-top text-[#8b949e]">{item.oQueFalta}</td>
                    <td className="px-2 py-2 align-top">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onVerItemNaMatriz(item)}
                          className="text-[#58a6ff] hover:underline"
                        >
                          Ver na matriz
                        </button>
                        {item.rota ? (
                          <Link href={item.rota} className="text-[#58a6ff] hover:underline">
                            Abrir tela
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {okItens.length > 0 ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setOkVisivel((v) => !v)}
            className="text-xs text-[#8b949e] hover:text-[#e6edf3]"
          >
            {okVisivel ? "▾" : "▸"} Itens OK ({okItens.length})
          </button>
          {okVisivel ? (
            <ul className="mt-2 space-y-1 text-xs text-[#6e7681]">
              {okItens.map((item) => (
                <li key={item.id}>{item.titulo}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onVerTodosNaMatriz}
          className="rounded-lg border px-3 py-2 text-xs font-medium text-[#c9a24a] hover:bg-[#c9a24a12]"
          style={{ borderColor: "#c9a24a44" }}
        >
          Ver todos na matriz — filtro {fase}
        </button>
      </div>
    </div>
  );
}

function hojeIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ontemIsoLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function parseRelatorioApiError(res: Response): Promise<string> {
  const fallback = `Erro ${res.status}`;
  const clone = res.clone();
  try {
    const body = (await clone.json()) as { error?: string };
    if (body.error?.trim()) return body.error.trim();
  } catch {
    /* HTML ou corpo vazio */
  }
  try {
    const text = (await res.text()).replace(/\s+/g, " ").trim();
    if (text) return text.length > 200 ? `${text.slice(0, 200)}…` : text;
  } catch {
    /* ignore */
  }
  return fallback;
}

function RelatorioDoDiaSection() {
  const [date, setDate] = useState(hojeIsoLocal);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [preview, setPreview] = useState<RelatorioDiarioPayload | null>(null);

  async function baixarPdf() {
    setLoading(true);
    setErro(null);
    try {
      const headers = await crmApiHeaders();
      const res = await fetch(`/api/crm/relatorio-diario?format=pdf&date=${encodeURIComponent(date)}`, { headers });
      if (!res.ok) {
        throw new Error(await parseRelatorioApiError(res));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `obra10-relatorio-${date}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao gerar PDF.");
    } finally {
      setLoading(false);
    }
  }

  async function carregarPreview() {
    setLoading(true);
    setErro(null);
    try {
      const headers = await crmApiHeaders();
      const res = await fetch(`/api/crm/relatorio-diario?format=json&date=${encodeURIComponent(date)}`, { headers });
      if (!res.ok) {
        throw new Error(await parseRelatorioApiError(res));
      }
      setPreview((await res.json()) as RelatorioDiarioPayload);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar preview.");
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      className="rounded-xl border p-4"
      style={{ borderColor: "#c9a24a44", background: "#0f1d16" }}
    >
      <h2 className="text-xs font-bold uppercase tracking-wider text-[#c9a24a]">Relatório do dia</h2>
      <p className="mt-1 text-xs text-[#8b949e]">
        Resumo do dia por áreas (Implementado / Corrigido), estado do sistema face ao plano Obra10+ e anexo Git
        compacto. Gere o PDF e envie manualmente no WhatsApp.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-[#8b949e]">
          Data
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm text-[#e6edf3]"
            style={{ borderColor: "#1d3a2c", background: "#0a140f" }}
          />
        </label>
        <button
          type="button"
          onClick={() => setDate(ontemIsoLocal())}
          className="rounded-lg border px-3 py-2 text-xs text-[#8b949e] hover:border-[#c9a24a55]"
          style={{ borderColor: "#1d3a2c" }}
        >
          Ontem
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void baixarPdf()}
          className="rounded-lg px-4 py-2 text-xs font-bold text-[#0a140f] disabled:opacity-50"
          style={{ background: "#c9a24a" }}
        >
          {loading ? "A gerar…" : "Gerar PDF"}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void carregarPreview()}
          className="rounded-lg border px-4 py-2 text-xs font-medium text-[#e6edf3] hover:border-[#c9a24a55] disabled:opacity-50"
          style={{ borderColor: "#1d3a2c", background: "#0a140f" }}
        >
          Pré-visualizar JSON
        </button>
        <a
          href="https://wa.me/5511950864013"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border px-4 py-2 text-xs text-[#3fb950] hover:border-[#22c55e55]"
          style={{ borderColor: "#1d3a2c" }}
        >
          WhatsApp Nice
        </a>
      </div>
      {erro ? <p className="mt-2 text-xs text-[#f87171]">{erro}</p> : null}
      {preview ? (
        <pre
          className="mt-3 max-h-64 overflow-auto rounded-lg border p-3 text-[10px] text-[#8b949e]"
          style={{ borderColor: "#1d3a2c", background: "#0a140f" }}
        >
          {JSON.stringify(preview, null, 2)}
        </pre>
      ) : null}
    </section>
  );
}

export function ProgressoSistemaDashboard() {
  const mergedItens = useMemo(() => mergeProgressoItens(), []);
  const verificacaoMeta = useMemo(() => getProgressoVerificacaoMeta(), []);
  const stats = useMemo(() => computeProgressoStats(mergedItens), [mergedItens]);
  const proximos = useMemo(() => getProximosPassos(), []);
  const funilLead = useMemo(() => getFunilLeadViz(), []);
  const mercados = useMemo(() => getMercadosViz(), []);
  const deployStats = useMemo(() => getDeployStats(), []);

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<ProgressoStatus | "">("");
  const [filtroFase, setFiltroFase] = useState<ProgressoFase | "">("");
  const [filtroPrioridade, setFiltroPrioridade] = useState<ProgressoPrioridade | "">("");
  const [faseExpandida, setFaseExpandida] = useState<ProgressoFase | null>(null);
  const [blocosAbertos, setBlocosAbertos] = useState<Set<string>>(() => new Set([PROGRESSO_BLOCOS[0]?.id ?? ""]));

  const blocoRefs = useRef<Record<string, HTMLElement | null>>({});
  const filtrosRef = useRef<HTMLDivElement | null>(null);

  const blocosFiltrados = useMemo(() => {
    const byId = Object.fromEntries(mergedItens.map((i) => [i.id, i]));
    const q = busca.trim().toLowerCase();
    return PROGRESSO_BLOCOS.map((bloco) => {
      const itens = bloco.itens
        .map((i) => byId[i.id] ?? i)
        .filter((item) => {
        if (filtroStatus && item.status !== filtroStatus) return false;
        if (filtroFase && item.fase !== filtroFase) return false;
        if (filtroPrioridade && item.prioridade !== filtroPrioridade) return false;
        if (!q) return true;
        return (
          item.titulo.toLowerCase().includes(q) ||
          item.oQueTemos.toLowerCase().includes(q) ||
          item.oQueFalta.toLowerCase().includes(q) ||
          item.pdfRef.toLowerCase().includes(q)
        );
      });
      return { ...bloco, itens };
    }).filter((b) => b.itens.length > 0);
  }, [busca, filtroStatus, filtroFase, filtroPrioridade, mergedItens]);

  function toggleBloco(id: string) {
    setBlocosAbertos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function abrirBloco(id: string) {
    setBlocosAbertos((prev) => new Set(prev).add(id));
    requestAnimationFrame(() => {
      blocoRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function expandirTodos() {
    setBlocosAbertos(new Set(PROGRESSO_BLOCOS.map((b) => b.id)));
  }

  function recolherTodos() {
    setBlocosAbertos(new Set());
  }

  function toggleFase(f: ProgressoFase) {
    setFaseExpandida((prev) => (prev === f ? null : f));
  }

  function verItemNaMatriz(item: ProgressoItem, fase: ProgressoFase) {
    setFiltroFase(fase);
    const blocoId = getBlocoIdPorItem(item.id);
    if (blocoId) abrirBloco(blocoId);
  }

  function verTodosNaMatriz(fase: ProgressoFase) {
    setFiltroFase(fase);
    requestAnimationFrame(() => {
      filtrosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 pb-10 pt-4 md:px-6">
      <p className="text-sm text-[#8b949e]">
        Comparação viva entre os PDFs <em>Funil Operacional CRM</em> e <em>Documento Funcional Consolidado</em> e o
        código em produção. Revisão matriz: {PROGRESSO_SISTEMA_REVISAO}.
        {verificacaoMeta.geradoEm ? (
          <>
            {" "}
            · <strong className="text-[#c9a24a]">Verificado no deploy</strong>{" "}
            {new Date(verificacaoMeta.geradoEm).toLocaleString("pt-BR")}
            {verificacaoMeta.ambiente ? ` (${verificacaoMeta.ambiente})` : ""}
          </>
        ) : null}
      </p>

      <RelatorioDoDiaSection />

      <section
        className="rounded-xl border px-4 py-3"
        style={{ borderColor: "#1d3a2c", background: "#0f1d16" }}
      >
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#c9a24a]">Como ler este painel</h2>
        <ul className="mt-2 space-y-1 text-xs text-[#8b949e]">
          <li>
            <strong className="text-[#e6edf3]">OK</strong> = implementado ·{" "}
            <strong className="text-[#e6edf3]">Parcial</strong> = existe mas não cobre o PDF ·{" "}
            <strong className="text-[#e6edf3]">Gap</strong> = ainda não feito
          </li>
          <li>
            <strong className="text-[#e6edf3]">Progresso global</strong> pondera OK=100% e Parcial=50% (gaps = 0%)
          </li>
          <li>
            <strong className="text-[#e6edf3]">Fases F0–F5</strong> = cronograma sugerido; a barra mostra % concluída
            na fase, não só quantidade de itens. Clique numa fase para ver o que falta e ir direto à matriz.
          </li>
          <li>
            Status <strong className="text-[#e6edf3]">OK / Parcial / Gap</strong> é recalculado automaticamente em cada
            deploy (<code className="text-[#8b949e]">verify:progresso</code>) — expanda evidências na matriz
          </li>
          <li>
            Regra central do PDF: <em>Lead → atendimento → negócio → projeto/obra → financeiro</em>
          </li>
        </ul>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Progresso global"
          value={`${stats.globalPct}%`}
          sub={`${stats.actionableTotal} requisitos avaliados`}
          accent="#c9a24a"
        />
        <KpiCard label="Itens OK" value={stats.ok} sub={`de ${stats.total} no total`} accent="#3fb950" />
        <KpiCard label="Parciais" value={stats.parcial} accent="#d29922" />
        <KpiCard label="Gaps P0" value={stats.gapP0} sub={`${stats.gap} gaps no total`} accent="#f87171" />
      </div>

      {proximos.length > 0 ? (
        <section className="rounded-xl border p-4" style={{ borderColor: "#c9a24a44", background: "#0f1d16" }}>
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#c9a24a]">
            Próximos passos (P0 em aberto) — {proximos.length}
          </h2>
          <p className="mt-1 text-xs text-[#8b949e]">Itens críticos com gap ou parcial, ordenados por fase do cronograma.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {proximos.slice(0, 8).map((item) => (
              <ProximoPassoCard key={item.id} item={item} />
            ))}
          </div>
          {proximos.length > 8 ? (
            <p className="mt-2 text-[10px] text-[#6e7681]">+ {proximos.length - 8} itens P0 — use os filtros abaixo</p>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-xl border p-4" style={{ borderColor: "#1d3a2c", background: "#0f1d16" }}>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#8b949e]">Cadeia de valor (PDF)</h2>
        <div className="flex flex-wrap items-center gap-1">
          {CADEIA_VALOR.map((elo, idx) => {
            const pct = getBlocoPct(elo.id);
            const c = pct >= 80 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444";
            return (
              <div key={`${elo.id}-${elo.label}`} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => abrirBloco(elo.id)}
                  className="rounded-lg border px-3 py-2 text-left transition hover:border-[#c9a24a55]"
                  style={{ borderColor: "#1d3a2c", background: "#0a140f", minWidth: 100 }}
                >
                  <p className="text-[11px] font-bold text-[#e6edf3]">{elo.label}</p>
                  <p className="text-[10px] text-[#6e7681]">{elo.sub}</p>
                  <p className="mt-1 text-sm font-bold" style={{ color: c }}>
                    {pct}%
                  </p>
                </button>
                {idx < CADEIA_VALOR.length - 1 ? (
                  <span className="text-[#6e7681] px-0.5" aria-hidden>
                    →
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border p-4" style={{ borderColor: "#1d3a2c", background: "#0f1d16" }}>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#8b949e]">Funil de leads — 8 etapas (PDF)</h2>
        <div className="flex flex-wrap gap-1.5">
          {funilLead.map((etapa) => {
            const c = STATUS_COLOR[etapa.status];
            return (
              <div
                key={etapa.slug}
                className="flex flex-col items-center rounded-lg border px-2 py-1.5"
                style={{ borderColor: c.border, background: c.bg, minWidth: 72 }}
                title={`${etapa.label}: ${STATUS_LABEL[etapa.status]}`}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: c.dot }} />
                <p className="mt-1 text-center text-[9px] font-medium leading-tight text-[#e6edf3]">{etapa.label}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border p-4" style={{ borderColor: "#1d3a2c", background: "#0f1d16" }}>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#8b949e]">Funis de negócio — 8 mercados (PDF)</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {mercados.map((m) => {
            const c = STATUS_COLOR[m.status];
            return (
              <div
                key={m.label}
                className="rounded-lg border px-2.5 py-2"
                style={{ borderColor: c.border, background: "#0a140f" }}
              >
                <p className="truncate text-[11px] font-medium text-[#e6edf3]">{m.label}</p>
                <div className="mt-1.5 flex items-center justify-between gap-1">
                  <StatusBadge status={m.status} />
                  <span className="text-[10px] text-[#6e7681]">{m.pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border p-4" style={{ borderColor: "#1d3a2c", background: "#0f1d16" }}>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#8b949e]">Cronograma por fase</h2>
        <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-6">
          {PROGRESSO_FASES.map((f) => {
            const fd = stats.byFase.find((x) => x.fase === f.id);
            const pct = fd?.pct ?? 0;
            const emAberto = fd?.emAberto ?? 0;
            const ativo = faseExpandida === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => toggleFase(f.id)}
                className="rounded-lg border px-3 py-2 text-left transition hover:border-[#c9a24a55]"
                style={{
                  borderColor: ativo ? "#c9a24a" : "#1d3a2c",
                  background: "#0a140f",
                  boxShadow: ativo ? "0 0 0 1px #c9a24a44" : undefined,
                }}
              >
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[11px] font-bold text-[#c9a24a]">{f.label}</p>
                  {ativo ? <span className="text-[10px] text-[#c9a24a]">▾</span> : null}
                </div>
                <p className="mt-0.5 text-[10px] text-[#6e7681]">{f.periodo}</p>
                <p className="mt-2 text-lg font-bold text-[#e6edf3]">{pct}%</p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#16271e]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: pct >= 80 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444",
                    }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-[#8b949e]">
                  {emAberto > 0 ? `${emAberto} em aberto` : "concluída"}
                </p>
              </button>
            );
          })}
        </div>
        {faseExpandida ? (
          <FaseDetalhePanel
            fase={faseExpandida}
            onFechar={() => setFaseExpandida(null)}
            onVerItemNaMatriz={(item) => verItemNaMatriz(item, faseExpandida)}
            onVerTodosNaMatriz={() => verTodosNaMatriz(faseExpandida)}
            onExpandirFase={setFaseExpandida}
          />
        ) : null}
      </section>

      <section className="rounded-xl border p-4" style={{ borderColor: "#1d3a2c", background: "#0f1d16" }}>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#8b949e]">Progresso por área</h2>
        <div className="space-y-3">
          {stats.byBloco.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => abrirBloco(b.id)}
              className="block w-full text-left"
            >
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-[#e6edf3] hover:text-[#c9a24a]">{b.titulo}</span>
                <span className="text-[#8b949e]">
                  {b.pct}% · {b.total} itens
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#16271e]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${b.pct}%`,
                    background: b.pct >= 80 ? "#22c55e" : b.pct >= 50 ? "#f59e0b" : "#ef4444",
                  }}
                />
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border p-4" style={{ borderColor: "#1d3a2c", background: "#0f1d16" }}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#8b949e]">Checklist deploy</h2>
          <span className="text-xs text-[#8b949e]">
            Go-live PDF: <strong className="text-[#e6edf3]">{deployStats.producao}/{deployStats.total}</strong>
            {deployStats.bloqueadoresPendentes > 0 ? (
              <span className="ml-2 text-[#f87171]">· {deployStats.bloqueadoresPendentes} bloqueadores em prod</span>
            ) : null}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-[#6e7681]">
                <th className="px-2 py-1.5">Item</th>
                <th className="px-2 py-1.5">Local</th>
                <th className="px-2 py-1.5">Staging</th>
                <th className="px-2 py-1.5">Produção</th>
              </tr>
            </thead>
            <tbody>
              {DEPLOY_CHECKLIST.map((row) => {
                const isBlocker = row.id.startsWith("mig-") || row.id.startsWith("smoke-");
                const autoOk =
                  deployStats.verificado && "deployDetalhe" in deployStats
                    ? deployStats.deployDetalhe?.[row.id]?.ok
                    : undefined;
                const checked = autoOk ?? row.producao;
                return (
                  <tr key={row.id} className="border-t border-[#1d3a2c]">
                    <td className="px-2 py-2 text-[#e6edf3]">
                      {row.label}
                      {isBlocker && !checked ? (
                        <span className="ml-1.5 text-[9px] font-bold uppercase text-[#f87171]">bloqueador</span>
                      ) : null}
                      {autoOk === false && deployStats.deployDetalhe?.[row.id]?.detail ? (
                        <p className="mt-0.5 text-[9px] text-[#8b949e]">{deployStats.deployDetalhe[row.id].detail}</p>
                      ) : null}
                    </td>
                    {(["local", "staging", "producao"] as const).map((env) => (
                      <td key={env} className="px-2 py-2">
                        <span style={{ color: checked ? "#3fb950" : "#6e7681" }}>{checked ? "✓" : "—"}</span>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div ref={filtrosRef} className="flex scroll-mt-4 flex-wrap items-center gap-2">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar requisito…"
          className="min-w-[200px] flex-1 rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "#1d3a2c", background: "#0a140f", color: "#e6edf3" }}
        />
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value as ProgressoStatus | "")}
          className="rounded-lg border px-2 py-2 text-xs"
          style={{ borderColor: "#1d3a2c", background: "#0a140f", color: "#e6edf3" }}
        >
          <option value="">Todos status</option>
          <option value="ok">OK</option>
          <option value="parcial">Parcial</option>
          <option value="gap">Gap</option>
        </select>
        <select
          value={filtroFase}
          onChange={(e) => setFiltroFase(e.target.value as ProgressoFase | "")}
          className="rounded-lg border px-2 py-2 text-xs"
          style={{ borderColor: "#1d3a2c", background: "#0a140f", color: "#e6edf3" }}
        >
          <option value="">Todas fases</option>
          {PROGRESSO_FASES.map((f) => (
            <option key={f.id} value={f.id}>
              {f.id}
            </option>
          ))}
        </select>
        <select
          value={filtroPrioridade}
          onChange={(e) => setFiltroPrioridade(e.target.value as ProgressoPrioridade | "")}
          className="rounded-lg border px-2 py-2 text-xs"
          style={{ borderColor: "#1d3a2c", background: "#0a140f", color: "#e6edf3" }}
        >
          <option value="">Todas prioridades</option>
          <option value="P0">P0</option>
          <option value="P1">P1</option>
          <option value="P2">P2</option>
        </select>
        <button
          type="button"
          onClick={expandirTodos}
          className="rounded-lg border px-3 py-2 text-xs text-[#8b949e] hover:text-[#e6edf3]"
          style={{ borderColor: "#1d3a2c" }}
        >
          Expandir tudo
        </button>
        <button
          type="button"
          onClick={recolherTodos}
          className="rounded-lg border px-3 py-2 text-xs text-[#8b949e] hover:text-[#e6edf3]"
          style={{ borderColor: "#1d3a2c" }}
        >
          Recolher tudo
        </button>
      </div>

      {blocosFiltrados.map((bloco) => {
        const aberto = blocosAbertos.has(bloco.id);
        const blocoPct = Math.round(
          bloco.itens
            .filter((i) => i.status !== "legado")
            .reduce((a, i) => a + (i.status === "ok" ? 100 : i.status === "parcial" ? 50 : 0), 0) /
            Math.max(1, bloco.itens.filter((i) => i.status !== "legado").length)
        );
        return (
          <section
            key={bloco.id}
            ref={(el) => {
              blocoRefs.current[bloco.id] = el;
            }}
            id={`bloco-${bloco.id}`}
            className="overflow-hidden rounded-xl border scroll-mt-4"
            style={{ borderColor: "#1d3a2c", background: "#0f1d16" }}
          >
            <button
              type="button"
              onClick={() => toggleBloco(bloco.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <div>
                <h3 className="text-sm font-bold text-[#e6edf3]">{bloco.titulo}</h3>
                <p className="mt-0.5 text-xs text-[#8b949e]">{bloco.descricao}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-sm font-bold text-[#c9a24a]">{blocoPct}%</span>
                <span className="text-xs text-[#6e7681]">{bloco.itens.length} itens</span>
                <span className="text-[#8b949e]">{aberto ? "▾" : "▸"}</span>
              </div>
            </button>
            {aberto ? (
              <div className="overflow-x-auto border-t border-[#1d3a2c]">
                <table className="w-full min-w-[900px] text-left">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-[#6e7681]">
                      <th className="px-3 py-2">Requisito</th>
                      <th className="px-3 py-2">O que temos</th>
                      <th className="px-3 py-2">O que falta</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Fase</th>
                      <th className="px-3 py-2">Prio</th>
                      <th className="px-3 py-2">Links</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bloco.itens.map((item) => (
                      <ItemRow key={item.id} item={item} />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        );
      })}

      {blocosFiltrados.length === 0 ? (
        <p className="text-center text-sm text-[#8b949e]">Nenhum item corresponde aos filtros.</p>
      ) : null}

      <footer className="border-t border-[#1d3a2c] pt-4 text-center text-[10px] text-[#6e7681]">
        Hub Obra10+ · Status automático via <code className="text-[#8b949e]">npm run verify:progresso</code> no deploy ·
        Matriz em <code className="text-[#8b949e]">lib/crm/progresso-sistema-data.ts</code>
      </footer>
    </div>
  );
}
