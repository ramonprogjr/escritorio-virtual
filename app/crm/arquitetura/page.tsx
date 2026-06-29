"use client";

import { Suspense, useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { useNarrowViewport } from "@/hooks/useNarrowViewport";
import { PipelineConfigSideover } from "@/components/crm/leads/PipelineConfigSideover";
import { ProjetoKanbanCard, type ProjetoKanbanCardData } from "@/components/crm/arquitetura/ProjetoKanbanCard";
import { NovoProjetoSideover } from "@/components/crm/arquitetura/NovoProjetoSideover";
import { toast } from "@/components/crm/toast";
import {
  ESTAGIOS_PROJETO_FALLBACK_UI,
  ESTAGIO_PROJETO_INICIAL,
  limparNomePipelineProjeto,
} from "@/lib/crm/arquitetura-page-helpers";

type Projeto = ProjetoKanbanCardData;

type PipelineUi = {
  id: string;
  slug: string;
  nome: string;
  mercado_sigla: string | null;
  estagios: { slug: string; label: string; cor: string; ativo: boolean; ordem?: number }[];
};

type EtapaUi = { id: string; label: string; color: string };

const ETAPAS_FALLBACK: EtapaUi[] = ESTAGIOS_PROJETO_FALLBACK_UI.map((e) => ({
  id: e.id,
  label: e.label,
  color: e.color,
}));

function ArquiteturaInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const narrow = useNarrowViewport();
  const isMobile = narrow !== false;

  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [moverAlvo, setMoverAlvo] = useState<Projeto | null>(null);
  const [total, setTotal] = useState(0);
  const [estagioCounts, setEstagioCounts] = useState<Record<string, number>>({});
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [pipelineConfigOpen, setPipelineConfigOpen] = useState(false);
  const [pipelines, setPipelines] = useState<PipelineUi[]>([]);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [etapasKanban, setEtapasKanban] = useState<EtapaUi[]>(ETAPAS_FALLBACK);
  const [negocioOrigem, setNegocioOrigem] = useState<string | null>(null);

  const carregarPipelines = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/pipelines?tipo=projeto", { headers: internalApiHeaders() });
      const json = await res.json().catch(() => ({ data: [] }));
      const list = (json.data || []) as PipelineUi[];
      if (!list.length) return;
      setPipelines(list);
      setPipelineId((prev) =>
        prev && list.some((p) => p.id === prev)
          ? prev
          : (list.find((p) => p.slug === "projetos-arq")?.id || list[0]?.id || null)
      );
    } catch {
      /* fallback in-code mantém o kanban funcional */
    }
  }, []);

  const pipelineAtivo = useMemo(
    () => pipelines.find((p) => p.id === pipelineId) ?? null,
    [pipelines, pipelineId]
  );

  useEffect(() => {
    void carregarPipelines();
  }, [carregarPipelines]);

  useEffect(() => {
    const cols =
      pipelineAtivo?.estagios
        ?.filter((e) => e.ativo !== false)
        .sort((a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0))
        .map((e) => ({ id: e.slug, label: e.label, color: e.cor || "#6B7280" })) ?? [];
    setEtapasKanban(cols.length ? cols : ETAPAS_FALLBACK);
  }, [pipelineAtivo]);

  const carregarLista = useCallback(() => {
    setCarregando(true);
    // Cada aba (pipeline) mostra só seus projetos (A0-DESIGN.md): filtra no backend.
    // Só filtra quando há 2+ pipelines de projeto (a aba desambigua). Com 1 pipeline,
    // ou pré-migração (projetos com pipeline_id NULL), NÃO filtra — preserva a
    // tolerância: nenhum projeto legado some até a migração A0 popular o pipeline_id.
    const filtrar = pipelineId && pipelines.length > 1;
    const qs = filtrar ? `?pipeline_id=${encodeURIComponent(pipelineId)}` : "";
    return fetch(`/api/crm/projetos${qs}`, { headers: internalApiHeaders() })
      .then((r) => r.json())
      .then((d) => {
        const rows = (d.data ?? []) as Array<Record<string, unknown>>;
        // normaliza: garante estagio (mapeia status legado se faltar a coluna).
        const norm: Projeto[] = rows.map((r) => ({
          id: String(r.id),
          codigo: (r.codigo as string) ?? null,
          titulo: String(r.titulo ?? "Projeto"),
          estagio: String(r.estagio ?? r.status ?? ESTAGIO_PROJETO_INICIAL),
          tipologia: (r.tipologia as string) ?? null,
          area_m2: typeof r.area_m2 === "number" ? r.area_m2 : null,
          cliente_nome: (r.cliente_nome as string) ?? null,
          responsavel_id: (r.responsavel_id as string) ?? null,
          proxima_entrega: (r.proxima_entrega as string) ?? null,
          proxima_entrega_em: (r.proxima_entrega_em as string) ?? null,
          aprovacao_status: (r.aprovacao_status as string) ?? "sem_aprovacao",
          criado_em: (r.criado_em as string) ?? null,
        }));
        setProjetos(norm);
        setTotal(Number(d.total ?? norm.length));
        setEstagioCounts((d.estagio_counts ?? {}) as Record<string, number>);
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [pipelineId, pipelines.length]);

  useEffect(() => {
    void carregarLista();
  }, [carregarLista]);

  // Deep-link: /crm/arquitetura?novo=1 ou ?negocio_id=... abre o criador.
  useEffect(() => {
    const negocioId = searchParams.get("negocio_id");
    if (searchParams.get("novo") === "1" || negocioId) {
      setNegocioOrigem(negocioId);
      setDrawerAberto(true);
      const p = new URLSearchParams(searchParams.toString());
      p.delete("novo");
      p.delete("negocio_id");
      const q = p.toString();
      router.replace(q ? `/crm/arquitetura?${q}` : "/crm/arquitetura");
    }
  }, [searchParams, router]);

  async function moverEtapa(projetoId: string, novaEtapa: string) {
    const prev = projetos.find((p) => p.id === projetoId)?.estagio ?? null;
    // otimista
    setProjetos((arr) => arr.map((p) => (p.id === projetoId ? { ...p, estagio: novaEtapa } : p)));
    const res = await fetch(`/api/crm/projetos/${projetoId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({ estagio: novaEtapa }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      // rollback
      if (prev) setProjetos((arr) => arr.map((p) => (p.id === projetoId ? { ...p, estagio: prev } : p)));
      toast.error(typeof json?.error === "string" ? json.error : "Não foi possível mover o projeto.");
      return;
    }
    const destino = etapasKanban.find((e) => e.id === novaEtapa);
    toast.success(`Movido para ${destino?.label ?? novaEtapa}`);
    void carregarLista();
  }

  const projetosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return projetos;
    return projetos.filter((p) =>
      `${p.titulo} ${p.codigo ?? ""} ${p.cliente_nome ?? ""}`.toLowerCase().includes(q)
    );
  }, [projetos, busca]);

  // KPIs
  const hoje = new Date();
  const hoje0 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
  const entregasHoje = projetos.filter((p) => {
    if (!p.proxima_entrega_em) return false;
    const d = new Date(p.proxima_entrega_em);
    return !Number.isNaN(d.getTime()) &&
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() === hoje0;
  }).length;
  const emAprovacao = projetos.filter((p) => p.estagio === "aprovacao").length; // keystone
  const atrasados = projetos.filter((p) => {
    if (!p.proxima_entrega_em || p.estagio === "entregue" || p.estagio === "arquivado") return false;
    const d = new Date(p.proxima_entrega_em);
    return !Number.isNaN(d.getTime()) &&
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() < hoje0;
  }).length;
  const entreguesMes = projetos.filter((p) => {
    if (p.estagio !== "entregue" || !p.criado_em) return false;
    const d = new Date(p.criado_em);
    return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
  }).length;

  const kpis = [
    { label: "Entregas hoje", value: String(entregasHoje), cor: "#c9a24a" },
    { label: "Em aprovação", value: String(emAprovacao), cor: "#d6a129" },
    { label: "Atrasados", value: String(atrasados), cor: atrasados > 0 ? "#f85149" : "#8b949e" },
    { label: "Entregues/mês", value: String(entreguesMes), cor: "#22c55e" },
  ];

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0a140f]">
      <NovoProjetoSideover
        open={drawerAberto}
        onClose={() => {
          setDrawerAberto(false);
          setNegocioOrigem(null);
        }}
        negocioId={negocioOrigem}
        onCreated={(projeto, jaExistia) => {
          toast.success(jaExistia ? `Abrindo ${projeto.codigo ?? "projeto"} existente` : `${projeto.codigo ?? "Projeto"} criado`);
          void carregarLista();
          router.push(`/crm/arquitetura/${projeto.id}`);
        }}
      />

      <PipelineConfigSideover
        open={pipelineConfigOpen}
        onClose={() => setPipelineConfigOpen(false)}
        tipo="projeto"
        pipelineId={pipelineId}
        onSelectPipeline={setPipelineId}
        showPipelineAdmin={false}
        onUpdated={() => {
          void carregarPipelines();
          void carregarLista();
        }}
      />

      {moverAlvo ? (
        <div className="fixed inset-0 z-[130] flex items-end justify-center sm:items-center md:p-4">
          <button type="button" className="absolute inset-0 bg-black/60" aria-label="Fechar" onClick={() => setMoverAlvo(null)} />
          <div className="relative max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-[#1d3a2c] bg-[#0f1d16] p-4 sm:rounded-2xl">
            <div className="mb-1 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-bold text-[#e6edf3]">Mover estágio</h2>
                <p className="truncate text-xs text-[#8b949e]">{moverAlvo.titulo}</p>
              </div>
              <button type="button" onClick={() => setMoverAlvo(null)} className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#16271e] text-[#8b949e]" aria-label="Fechar">✕</button>
            </div>
            <div className="mt-3 space-y-1.5">
              {etapasKanban.map((est) => {
                const atual = est.id === moverAlvo.estagio;
                return (
                  <button
                    key={est.id}
                    type="button"
                    disabled={atual}
                    onClick={() => {
                      const alvo = moverAlvo;
                      setMoverAlvo(null);
                      void moverEtapa(alvo.id, est.id);
                    }}
                    className="flex w-full min-h-12 items-center gap-3 rounded-xl border px-3 text-left text-sm font-semibold transition-colors disabled:opacity-50"
                    style={{
                      borderColor: atual ? est.color : "#1d3a2c",
                      background: atual ? est.color + "1A" : "#0a140f",
                      color: atual ? est.color : "#e6edf3",
                      cursor: atual ? "default" : "pointer",
                    }}
                  >
                    <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: est.color }} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{est.label}</span>
                    {atual ? <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wide">Atual</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {/* Cabeçalho */}
      <div className="sticky top-0 z-20 shrink-0 space-y-2 border-b border-[#1d3a2c] bg-[#0f1d16] px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-base font-bold text-[#e6edf3] sm:text-lg">Arquitetura</h1>
            <p className="text-[11px] text-[#8b949e]">
              {limparNomePipelineProjeto(pipelineAtivo?.nome) || "Funil de projeto"} · {total} projetos
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setDrawerAberto(true)}
              className="min-h-10 shrink-0 rounded-lg px-4 py-2 text-sm font-bold"
              style={{ background: "#003b26", color: "#c9a24a", border: "none", cursor: "pointer" }}
            >
              + Novo projeto
            </button>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar projeto, cliente ou código…"
              className="min-h-10 w-full min-w-0 rounded-lg border border-[#1d3a2c] bg-[#16271e] px-3 py-2 text-sm text-[#e6edf3] outline-none placeholder:text-[#6e7681] focus:border-[#c9a24a] sm:w-56"
            />
            <button
              type="button"
              onClick={() => setPipelineConfigOpen(true)}
              className="min-h-10 shrink-0 rounded-lg border border-[#1d3a2c] bg-[#16271e] px-3 py-2 text-xs font-bold text-[#8b949e] hover:text-[#e6edf3]"
            >
              Editar etapas
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-px bg-[#1d3a2c] sm:grid-cols-4">
        {kpis.map((m) => (
          <div key={m.label} className="bg-[#0f1d16] px-3 py-2.5 sm:px-5">
            <p className="mb-0.5 text-xs text-[#8b949e]">{m.label}</p>
            <p className="text-base font-black sm:text-lg" style={{ color: m.cor }}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Board */}
      <div className="flex-1 overflow-hidden">
        {carregando && projetos.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-sm text-[#8b949e]">Carregando projetos...</div>
        ) : (
          <div className={`flex h-full overflow-x-auto ${isMobile ? "snap-x snap-mandatory scroll-pl-3 gap-2.5 px-3 py-3 scrollbar-none" : "gap-3 p-4"}`}>
            {etapasKanban.map((est) => {
              const col = projetosFiltrados.filter((p) => p.estagio === est.id);
              const countCol = busca.trim() ? col.length : (estagioCounts[est.id] ?? col.length);
              return (
                <div key={est.id} className={`flex flex-shrink-0 flex-col ${isMobile ? "w-[clamp(11rem,72vw,18rem)] snap-start" : "min-w-[300px] w-[300px]"}`}>
                  <div className="rounded-t-xl px-3 py-2.5" style={{ backgroundColor: est.color + "1A", borderLeft: `3px solid ${est.color}`, borderTop: `1px solid ${est.color}40`, borderRight: `1px solid ${est.color}40` }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{est.label}</span>
                      <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: est.color + "40" }}>{countCol}</span>
                    </div>
                  </div>
                  <div
                    className="flex-1 space-y-2 overflow-y-auto rounded-b-xl border border-t-0 border-[#1d3a2c] bg-[#0f1d16]/60 p-2 transition-colors"
                    style={{ minHeight: 80, backgroundColor: dragOver === est.id ? est.color + "12" : undefined }}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(est.id); }}
                    onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const id = e.dataTransfer.getData("projetoId");
                      if (id) void moverEtapa(id, est.id);
                      setDragId(null);
                      setDragOver(null);
                    }}
                  >
                    {col.map((projeto) => (
                      <ProjetoKanbanCard
                        key={projeto.id}
                        projeto={projeto}
                        accent={est.color}
                        dragging={dragId === projeto.id}
                        draggable={!isMobile}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("projetoId", projeto.id);
                          setDragId(projeto.id);
                        }}
                        onDragEnd={() => { setDragId(null); setDragOver(null); }}
                        onOpen={() => router.push(`/crm/arquitetura/${projeto.id}`)}
                        onEdit={() => router.push(`/crm/arquitetura/${projeto.id}`)}
                        onMove={isMobile ? () => setMoverAlvo(projeto) : undefined}
                      />
                    ))}
                    {col.length === 0 ? <p className="py-4 text-center text-xs text-[#484f58]">vazio</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ArquiteturaPage() {
  return (
    <Suspense fallback={<div className="min-h-full bg-[#0a140f] p-6 text-sm text-[#8b949e]">Carregando…</div>}>
      <ArquiteturaInner />
    </Suspense>
  );
}
