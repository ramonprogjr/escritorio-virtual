"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, MessageSquare, LayoutList, GitBranch, FileText, HardHat, Mic, Plus,
  ChevronDown, X, Check, Clock, Send, Paperclip, RotateCcw, Trash2,
} from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { toast } from "@/components/crm/toast";
import {
  ESTAGIOS_PROJETO_FALLBACK_UI,
  COR_ESTAGIO_PROJETO,
  APROVACAO_PROJETO,
  COMODOS_SUGERIDOS,
  CATALOGO_COMODOS,
  CATEGORIAS_COMODO,
  tipologiaLabel,
  type AprovacaoProjetoStatus,
} from "@/lib/crm/projeto-funil-defaults";

type Projeto = {
  id: string;
  codigo: string | null;
  titulo: string;
  estagio?: string;
  status?: string;
  tipologia: string | null;
  area_m2: number | null;
  cliente_nome: string | null;
  aprovacao_status: string | null;
  proxima_entrega: string | null;
  proxima_entrega_em: string | null;
  negocio_id: string | null;
  obra_id: string | null;
};

type Fase = {
  id: string;
  nome: string;
  ordem: number;
  status: string;
  tipo?: string;
  categoria?: string | null;
  metragem_m2?: number | null;
  observacao?: string | null;
  aprovacao_status?: string | null;
  entregavel_url?: string | null;
  aprovacao_enviado_em?: string | null;
  aprovacao_respondido_em?: string | null;
  aprovacao_motivo?: string | null;
};

type Aba = "conversar" | "programa" | "funil" | "entregaveis" | "engenharia";

const ABAS: { id: Aba; label: string; Icon: typeof MessageSquare }[] = [
  { id: "conversar", label: "Conversar", Icon: MessageSquare },
  { id: "programa", label: "Programa", Icon: LayoutList },
  { id: "funil", label: "Funil", Icon: GitBranch },
  { id: "entregaveis", label: "Entregáveis", Icon: FileText },
  { id: "engenharia", label: "Engenharia", Icon: HardHat },
];

const CAT_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIAS_COMODO.map((c) => [c.slug, c.label])
);

/** Cor + rótulo do estado de UM entregável (aba Entregáveis). */
function estadoEntregavel(ap: string): { label: string; cor: string } {
  switch (ap) {
    case "aprovado": return { label: "Aprovado", cor: "#22c55e" };
    case "enviado": return { label: "Aguardando cliente", cor: "#c9a24a" };
    case "rejeitado": return { label: "Reprovado", cor: "#ef4444" };
    default: return { label: "A fazer", cor: "#8b949e" };
  }
}

export default function ProjetoFichaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Deep-link de aba (?aba=entregaveis) — usado pela fila/chip "Em aprovação" da
  // listagem para abrir direto onde mora a aprovação pendente. Cai em "conversar"
  // se o param vier ausente ou inválido.
  const abaInicial = ((): Aba => {
    const q = searchParams.get("aba");
    return q && ABAS.some((a) => a.id === q) ? (q as Aba) : "conversar";
  })();

  const [projeto, setProjeto] = useState<Projeto | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [aba, setAba] = useState<Aba>(abaInicial);
  const [fases, setFases] = useState<Fase[]>([]);
  const [catalogoAberto, setCatalogoAberto] = useState(false);

  // Desfazer remoção de cômodo (5s).
  const undoRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [removidoUndo, setRemovidoUndo] = useState<Fase | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch(`/api/crm/projetos/${id}`, { headers: internalApiHeaders() });
      const json = await res.json();
      if (res.ok && json.data) setProjeto(json.data as Projeto);
    } finally {
      setCarregando(false);
    }
  }, [id]);

  const carregarFases = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/projetos/${id}/programa`, { headers: internalApiHeaders() });
      const json = await res.json();
      if (res.ok) setFases((json.data ?? []) as Fase[]);
    } catch {
      /* degrada */
    }
  }, [id]);

  useEffect(() => {
    void carregar();
    void carregarFases();
  }, [carregar, carregarFases]);

  useEffect(() => () => { if (undoRef.current) clearTimeout(undoRef.current); }, []);

  const estagio = projeto?.estagio || projeto?.status || "briefing";
  const corEstagio = COR_ESTAGIO_PROJETO[estagio] || "#6B7280";
  const aprov = APROVACAO_PROJETO[(projeto?.aprovacao_status ?? "sem_aprovacao") as AprovacaoProjetoStatus] ?? APROVACAO_PROJETO.sem_aprovacao;

  const comodos = useMemo(() => fases.filter((f) => (f.tipo ?? "comodo") === "comodo"), [fases]);
  const entregaveis = useMemo(() => fases.filter((f) => f.tipo === "fase"), [fases]);
  const totalPrograma = comodos.reduce((s, c) => s + (Number(c.metragem_m2) || 0), 0);

  // Cômodos agrupados por categoria (display da aba Programa).
  const comodosPorCategoria = useMemo(() => {
    const grupos: Record<string, Fase[]> = {};
    for (const c of comodos) {
      const cat = c.categoria ?? "ambiente";
      (grupos[cat] ??= []).push(c);
    }
    return grupos;
  }, [comodos]);

  // Agregado dos entregáveis (status geral da aba Entregáveis).
  const resumoEntregaveis = useMemo(() => {
    let aguardando = 0, aprovados = 0, reprovados = 0, afazer = 0;
    for (const e of entregaveis) {
      const ap = e.aprovacao_status ?? "pendente";
      if (ap === "enviado") aguardando++;
      else if (ap === "aprovado") aprovados++;
      else if (ap === "rejeitado") reprovados++;
      else afazer++;
    }
    return { aguardando, aprovados, reprovados, afazer };
  }, [entregaveis]);

  async function moverEstagio(novo: string) {
    const res = await fetch(`/api/crm/projetos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({ estagio: novo }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(typeof json?.error === "string" ? json.error : "Não foi possível mover.");
      return;
    }
    toast.success("Estágio atualizado");
    void carregar();
  }

  async function adicionarComodo(nome: string, categoria: string) {
    const res = await fetch(`/api/crm/projetos/${id}/programa`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({ tipo: "comodo", itens: [{ nome, categoria }] }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(typeof json?.error === "string" ? json.error : "Não foi possível adicionar.");
      return;
    }
    toast.success(`${nome} adicionado ao programa`);
    void carregarFases();
  }

  async function patchComodo(faseId: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/crm/projetos/${id}/programa/${faseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(typeof json?.error === "string" ? json.error : "Não foi possível salvar.");
      return false;
    }
    void carregarFases();
    return true;
  }

  function removerComodoComUndo(fase: Fase) {
    // Remoção otimista local + janela de 5s para desfazer (só efetiva no fim).
    setFases((arr) => arr.filter((f) => f.id !== fase.id));
    setRemovidoUndo(fase);
    if (undoRef.current) clearTimeout(undoRef.current);
    undoRef.current = setTimeout(() => {
      void efetivarRemocao(fase);
      setRemovidoUndo(null);
    }, 5000);
  }

  async function efetivarRemocao(fase: Fase) {
    const res = await fetch(`/api/crm/projetos/${id}/programa/${fase.id}`, {
      method: "DELETE",
      headers: internalApiHeaders(),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(typeof json?.error === "string" ? json.error : "Não foi possível remover.");
      void carregarFases(); // ressincroniza (volta o item).
    }
  }

  function desfazerRemocao() {
    if (undoRef.current) clearTimeout(undoRef.current);
    if (removidoUndo) setFases((arr) => [...arr, removidoUndo].sort((a, b) => a.ordem - b.ordem));
    setRemovidoUndo(null);
  }

  if (carregando && !projeto) {
    return <div className="min-h-full bg-[#0a140f] p-6 text-sm text-[#8b949e]">Carregando projeto…</div>;
  }
  if (!projeto) {
    return (
      <div className="min-h-full bg-[#0a140f] p-6 text-sm text-[#8b949e]">
        Projeto não encontrado.{" "}
        <Link href="/crm/arquitetura" className="font-bold text-[#c9a24a]">← Voltar</Link>
      </div>
    );
  }

  const podeGerarObra = estagio === "entregue";

  return (
    <div className="min-h-full bg-[#0a140f]">
      {/* Cabeçalho da ficha */}
      <div className="border-b border-[#1d3a2c] bg-[#0f1d16] px-4 py-3" style={{ borderTop: `2px solid ${corEstagio}` }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0">
            <button
              type="button"
              onClick={() => router.push("/crm/arquitetura")}
              className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#16271e] text-[#8b949e]"
              aria-label="Voltar"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-[#e6edf3]">{projeto.titulo}</h1>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono text-[#c9a24a]">{projeto.codigo ?? "—"}</span>
                {projeto.tipologia ? (
                  <span className="rounded-full px-2 py-0.5 font-bold" style={{ background: "rgba(201,162,74,0.16)", color: "#e0b86a" }}>
                    {tipologiaLabel(projeto.tipologia)}
                  </span>
                ) : null}
                {projeto.area_m2 ? <span className="text-[#94a3b8]">{projeto.area_m2}m²</span> : null}
                <span className="text-[#8b949e]">· {projeto.cliente_nome?.trim() || "Sem cliente"}</span>
              </div>
            </div>
          </div>
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{ background: `${aprov.cor}18`, color: aprov.cor, border: `1px solid ${aprov.cor}40` }}
          >
            {aprov.label}
          </span>
        </div>
        {projeto.negocio_id ? (
          <p className="mt-2 text-[11px] text-[#6e7681]">
            Origem:{" "}
            <Link href={`/crm/negocios/${projeto.negocio_id}`} className="font-bold text-[#c9a24a]">
              negócio →
            </Link>
          </p>
        ) : null}
      </div>

      {/* Abas — desktop tabs / mobile select */}
      <div className="border-b border-[#1d3a2c] bg-[#0f1d16] px-4">
        <div className="hidden gap-1 sm:flex">
          {ABAS.map(({ id: aId, label, Icon }) => {
            const ativo = aba === aId;
            const badge = aId === "entregaveis" && resumoEntregaveis.aguardando > 0 ? resumoEntregaveis.aguardando : null;
            return (
              <button
                key={aId}
                type="button"
                onClick={() => setAba(aId)}
                className="flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-bold transition-colors"
                style={{
                  borderColor: ativo ? "#c9a24a" : "transparent",
                  color: ativo ? "#e6edf3" : "#8b949e",
                }}
              >
                <Icon size={15} /> {label}
                {badge ? (
                  <span className="ml-0.5 rounded-full px-1.5 text-[10px] font-black" style={{ background: "#c9a24a22", color: "#c9a24a" }}>
                    {badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="py-2 sm:hidden">
          <select
            value={aba}
            onChange={(e) => setAba(e.target.value as Aba)}
            className="w-full rounded-lg border border-[#1d3a2c] bg-[#16271e] px-3 py-2 text-sm font-bold text-[#e6edf3]"
          >
            {ABAS.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="p-4">
        {/* CONVERSAR (default) */}
        {aba === "conversar" ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#1d3a2c] bg-[#0f1d16] p-4">
              <p className="text-sm text-[#e6edf3]">
                Use o copiloto para criar, mover de estágio, montar o programa ou enviar entregáveis para aprovação por voz ou texto.
              </p>
              <p className="mt-1 text-xs text-[#8b949e]">
                A IA propõe — você confirma. Nada é alterado sem sua confirmação.
              </p>
              <button
                type="button"
                onClick={() => { if (typeof window !== "undefined") window.dispatchEvent(new Event("copiloto:abrir")); }}
                className="mt-3 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold"
                style={{ background: "linear-gradient(180deg, #1d5c3c, #003b26)", color: "#f0c869", border: "1px solid #c9a24a" }}
              >
                <Mic size={16} /> Falar com o copiloto
              </button>
            </div>
            {projeto.aprovacao_status === "aguardando" ? (
              <button
                type="button"
                onClick={() => setAba("entregaveis")}
                className="block w-full rounded-xl border border-[#c9a24a44] bg-[#1a1405] p-4 text-left"
              >
                <p className="text-sm font-bold text-[#f0c869]">Aprovação aguardando o cliente</p>
                <p className="mt-1 text-xs text-[#f3e6c4]">
                  Abra os Entregáveis para reforçar ou registrar a resposta. →
                </p>
              </button>
            ) : projeto.aprovacao_status === "reprovado" ? (
              <button
                type="button"
                onClick={() => setAba("entregaveis")}
                className="block w-full rounded-xl border border-[#ef444444] bg-[#1a0808] p-4 text-left"
              >
                <p className="text-sm font-bold text-[#f87171]">Há entregável reprovado pelo cliente</p>
                <p className="mt-1 text-xs text-[#f3c4c4]">
                  Reenvie com revisão pelos Entregáveis. →
                </p>
              </button>
            ) : null}
          </div>
        ) : null}

        {/* PROGRAMA (tipo='comodo') — editável */}
        {aba === "programa" ? (
          <div className="space-y-4">
            {/* Barra de metragem: verde ≤ contratada, âmbar se estoura */}
            <div className="rounded-xl border border-[#1d3a2c] bg-[#0f1d16] p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#e6edf3]">{comodos.length} ambiente{comodos.length === 1 ? "" : "s"}</span>
                <span className="text-[#8b949e]">
                  Total <strong className="text-[#e6edf3]">{totalPrograma || 0}m²</strong>
                  {projeto.area_m2 ? <> · contratada <strong className="text-[#e6edf3]">{projeto.area_m2}m²</strong></> : null}
                </span>
              </div>
              {projeto.area_m2 && projeto.area_m2 > 0 ? (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#16271e]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (totalPrograma / projeto.area_m2) * 100)}%`,
                      background: totalPrograma > projeto.area_m2 ? "#f59e0b" : "#22c55e",
                    }}
                  />
                </div>
              ) : null}
            </div>

            {/* Faixa conversacional → copiloto */}
            <button
              type="button"
              onClick={() => { if (typeof window !== "undefined") window.dispatchEvent(new Event("copiloto:abrir")); }}
              className="flex w-full items-center gap-2 rounded-xl border border-[#1d3a2c] bg-[#0f1d16] px-3 py-2.5 text-left text-xs text-[#8b949e]"
            >
              <Mic size={14} className="text-[#c9a24a]" />
              <span className="truncate">“adiciona suíte master, closet e varanda gourmet…”</span>
            </button>

            {/* + Adicionar ambiente → abre catálogo (não input livre) */}
            <button
              type="button"
              onClick={() => setCatalogoAberto(true)}
              className="flex w-full items-center justify-between rounded-xl border border-dashed border-[#c9a24a44] bg-[#0f1d16] px-4 py-3 text-sm font-bold text-[#c9a24a]"
            >
              <span className="inline-flex items-center gap-2"><Plus size={16} /> Adicionar ambiente</span>
              <ChevronDown size={16} />
            </button>

            {comodos.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#1d3a2c] bg-[#0f1d16] p-6 text-center text-sm text-[#8b949e]">
                Programa vazio. Toque em “Adicionar ambiente” para escolher do catálogo.
              </p>
            ) : (
              <div className="space-y-4">
                {CATEGORIAS_COMODO.map((cat) => {
                  const lista = comodosPorCategoria[cat.slug];
                  if (!lista || lista.length === 0) return null;
                  return (
                    <div key={cat.slug} className="space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-[#6e7681]">
                        {cat.label} · {lista.length}
                      </p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {lista.map((c) => (
                          <ComodoChip
                            key={c.id}
                            comodo={c}
                            onPatch={(body) => patchComodo(c.id, body)}
                            onRemover={() => removerComodoComUndo(c)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}

        {/* FUNIL (stepper) */}
        {aba === "funil" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {ESTAGIOS_PROJETO_FALLBACK_UI.map((e) => {
                const ativo = e.id === estagio;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => void moverEstagio(e.id)}
                    disabled={ativo}
                    className="rounded-xl border px-3 py-2 text-sm font-bold disabled:cursor-default"
                    style={{
                      borderColor: ativo ? e.color : "#1d3a2c",
                      background: ativo ? e.color + "1A" : "#0a140f",
                      color: ativo ? e.color : "#8b949e",
                    }}
                  >
                    {e.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-[#6e7681]">
              Toque num estágio para mover o projeto. Para renomear/reordenar as etapas, use “Editar etapas” no quadro.
            </p>
          </div>
        ) : null}

        {/* ENTREGÁVEIS (tipo='fase') — fluxo de aprovação */}
        {aba === "entregaveis" ? (
          <EntregaveisAba
            projetoId={id}
            entregaveis={entregaveis}
            resumo={resumoEntregaveis}
            onMudou={() => { void carregarFases(); void carregar(); }}
          />
        ) : null}

        {/* ENGENHARIA (ponte E0 · stub) */}
        {aba === "engenharia" ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-[#1d3a2c] bg-[#0f1d16] p-4">
              <p className="text-sm text-[#e6edf3]">
                Executivo aprovado? Gere a obra para orçar e executar.
              </p>
              <p className="mt-1 text-xs text-[#8b949e]">
                Disponível ao entregar o projeto. A obra é criada uma única vez por projeto.
              </p>
              <button
                type="button"
                disabled={!podeGerarObra}
                title={podeGerarObra ? "Gerar obra a partir deste projeto" : "Disponível ao entregar o projeto"}
                onClick={() => toast.success("Geração de obra entra no Bloco A2 (ponte E0).")}
                className="mt-3 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: podeGerarObra ? "#238636" : "#16271e", color: podeGerarObra ? "#fff" : "#6e7681", border: "1px solid #1d3a2c" }}
              >
                <HardHat size={16} /> Gerar obra
              </button>
            </div>
            {projeto.obra_id ? (
              <Link href={`/crm/obras/${projeto.obra_id}`} className="inline-flex text-xs font-bold text-[#c9a24a]">
                Ver obra vinculada →
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Catálogo de ambientes (bottom-sheet/popover) */}
      {catalogoAberto ? (
        <CatalogoComodos
          onFechar={() => setCatalogoAberto(false)}
          onEscolher={(nome, categoria) => { void adicionarComodo(nome, categoria); }}
        />
      ) : null}

      {/* Toast de Desfazer remoção */}
      {removidoUndo ? (
        <div className="fixed inset-x-0 bottom-4 z-[140] flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-xl border border-[#1d3a2c] bg-[#16271e] px-4 py-2.5 shadow-lg">
            <span className="text-sm text-[#e6edf3]">“{removidoUndo.nome}” removido</span>
            <button type="button" onClick={desfazerRemocao} className="inline-flex items-center gap-1 text-sm font-bold text-[#c9a24a]">
              <RotateCcw size={14} /> Desfazer
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Chip-card editável de um cômodo (metragem/observação/categoria inline + remover). */
function ComodoChip({
  comodo,
  onPatch,
  onRemover,
}: {
  comodo: Fase;
  onPatch: (body: Record<string, unknown>) => Promise<boolean>;
  onRemover: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [metragem, setMetragem] = useState(comodo.metragem_m2 != null ? String(comodo.metragem_m2) : "");
  const [observacao, setObservacao] = useState(comodo.observacao ?? "");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    const ok = await onPatch({
      metragem_m2: metragem.trim() === "" ? null : metragem.trim(),
      observacao: observacao.trim() === "" ? null : observacao,
    });
    setSalvando(false);
    if (ok) setEditando(false);
  }

  if (editando) {
    return (
      <div className="rounded-xl border border-[#c9a24a55] bg-[#0f1d16] p-3">
        <p className="mb-2 text-sm font-bold text-[#e6edf3]">{comodo.nome}</p>
        <div className="space-y-2">
          <label className="block text-[11px] text-[#8b949e]">
            Metragem (m²)
            <input
              type="number" inputMode="decimal" value={metragem} onChange={(e) => setMetragem(e.target.value)}
              placeholder="ex.: 24"
              className="mt-1 w-full rounded-lg border border-[#1d3a2c] bg-[#16271e] px-3 py-2 text-sm text-[#e6edf3] outline-none focus:border-[#c9a24a]"
            />
          </label>
          <label className="block text-[11px] text-[#8b949e]">
            Observação
            <input
              type="text" value={observacao} onChange={(e) => setObservacao(e.target.value)}
              placeholder="ex.: vista para o jardim"
              className="mt-1 w-full rounded-lg border border-[#1d3a2c] bg-[#16271e] px-3 py-2 text-sm text-[#e6edf3] outline-none focus:border-[#c9a24a]"
            />
          </label>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          <button type="button" onClick={() => setEditando(false)} className="rounded-lg px-3 py-1.5 text-xs font-bold text-[#8b949e]">
            Cancelar
          </button>
          <button
            type="button" onClick={() => void salvar()} disabled={salvando}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-60"
            style={{ background: "#003b26", color: "#c9a24a", border: "1px solid #c9a24a" }}
          >
            <Check size={13} /> {salvando ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-2 rounded-xl border border-[#1d3a2c] bg-[#0f1d16] px-3 py-2.5">
      <button type="button" onClick={() => setEditando(true)} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-bold text-[#e6edf3]">{comodo.nome}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-[#94a3b8]">
          {comodo.metragem_m2 ? <span>{comodo.metragem_m2}m²</span> : <span className="text-[#6e7681]">sem metragem</span>}
          {comodo.observacao ? <span className="truncate text-[#8b949e]">· {comodo.observacao}</span> : null}
        </span>
      </button>
      <button
        type="button" onClick={onRemover} aria-label={`Remover ${comodo.nome}`}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[#6e7681] hover:text-[#f85149]"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

/** Bottom-sheet com o catálogo de ambientes por categoria (Click-and-Go, sem input livre). */
function CatalogoComodos({
  onFechar,
  onEscolher,
}: {
  onFechar: () => void;
  onEscolher: (nome: string, categoria: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center sm:items-center md:p-4">
      <button type="button" className="absolute inset-0 bg-black/60" aria-label="Fechar" onClick={onFechar} />
      <div className="relative max-h-[82vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-[#1d3a2c] bg-[#0f1d16] p-4 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#e6edf3]">Adicionar ambiente</h2>
          <button type="button" onClick={onFechar} className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#16271e] text-[#8b949e]" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        {/* Sugestões rápidas (nascem como 'ambiente') */}
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#6e7681]">Rápidos</p>
        <div className="mb-4 flex flex-wrap gap-2">
          {COMODOS_SUGERIDOS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onEscolher(c, "ambiente")}
              className="inline-flex items-center gap-1 rounded-lg border border-[#1d3a2c] bg-[#16271e] px-3 py-1.5 text-xs font-bold text-[#c9a24a] hover:border-[#c9a24a66]"
            >
              <Plus size={12} /> {c}
            </button>
          ))}
        </div>

        {/* Acordeões por categoria */}
        {CATEGORIAS_COMODO.map((cat) => {
          const opcoes = CATALOGO_COMODOS[cat.slug] ?? [];
          if (opcoes.length === 0) return null;
          return (
            <div key={cat.slug} className="mb-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#6e7681]">{cat.label}</p>
              <div className="flex flex-wrap gap-2">
                {opcoes.map((nome) => (
                  <button
                    key={nome}
                    type="button"
                    onClick={() => onEscolher(nome, cat.slug)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#1d3a2c] bg-[#0f1d16] px-3 py-1.5 text-xs font-semibold text-[#c8d4e6] hover:border-[#c9a24a66] hover:text-[#c9a24a]"
                  >
                    <Plus size={12} className="text-[#6e7681]" /> {nome}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <p className="mt-2 text-center text-[11px] text-[#6e7681]">
          Toque para adicionar. Ajuste a metragem e a observação depois, no chip.
        </p>
      </div>
    </div>
  );
}

/** Aba Entregáveis: status geral + lista com a máquina de estados de aprovação. */
function EntregaveisAba({
  projetoId,
  entregaveis,
  resumo,
  onMudou,
}: {
  projetoId: string;
  entregaveis: Fase[];
  resumo: { aguardando: number; aprovados: number; reprovados: number; afazer: number };
  onMudou: () => void;
}) {
  const [novoNome, setNovoNome] = useState("");
  const [criando, setCriando] = useState(false);

  async function criarEntregavel() {
    const nome = novoNome.trim();
    if (!nome) return;
    setCriando(true);
    const res = await fetch(`/api/crm/projetos/${projetoId}/programa`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({ tipo: "fase", itens: [{ nome }] }),
    });
    setCriando(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(typeof json?.error === "string" ? json.error : "Não foi possível criar o entregável.");
      return;
    }
    setNovoNome("");
    toast.success(`${nome} adicionado`);
    onMudou();
  }

  return (
    <div className="space-y-3">
      {/* Status geral (agregado) */}
      <div className="rounded-xl border border-[#1d3a2c] bg-[#0f1d16] p-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1 text-[#c9a24a]"><Clock size={13} /> {resumo.aguardando} aguardando</span>
          <span className="inline-flex items-center gap-1 text-[#22c55e]"><Check size={13} /> {resumo.aprovados} aprovado{resumo.aprovados === 1 ? "" : "s"}</span>
          {resumo.reprovados > 0 ? <span className="inline-flex items-center gap-1 text-[#ef4444]"><X size={13} /> {resumo.reprovados} reprovado{resumo.reprovados === 1 ? "" : "s"}</span> : null}
          <span className="text-[#6e7681]">{resumo.afazer} a fazer</span>
        </div>
      </div>

      {/* + Novo entregável */}
      <div className="flex items-center gap-2">
        <input
          type="text" value={novoNome} onChange={(e) => setNovoNome(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void criarEntregavel(); }}
          placeholder="Novo entregável (ex.: Executivo - Pav 1)"
          className="min-h-10 flex-1 rounded-lg border border-[#1d3a2c] bg-[#16271e] px-3 py-2 text-sm text-[#e6edf3] outline-none placeholder:text-[#6e7681] focus:border-[#c9a24a]"
        />
        <button
          type="button" onClick={() => void criarEntregavel()} disabled={criando || !novoNome.trim()}
          className="min-h-10 shrink-0 rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-50"
          style={{ background: "#003b26", color: "#c9a24a", border: "1px solid #1d3a2c" }}
        >
          <Plus size={16} />
        </button>
      </div>

      {entregaveis.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#1d3a2c] bg-[#0f1d16] p-6 text-center text-sm text-[#8b949e]">
          Nenhum entregável ainda. Os entregáveis (estudos, anteprojeto, executivo) aparecem aqui por etapa.
        </p>
      ) : (
        entregaveis.map((e) => (
          <EntregavelCard key={e.id} projetoId={projetoId} entregavel={e} onMudou={onMudou} />
        ))
      )}
    </div>
  );
}

/** Card de UM entregável com as ações por estado (anexar/enviar/responder/reenviar). */
function EntregavelCard({
  projetoId,
  entregavel,
  onMudou,
}: {
  projetoId: string;
  entregavel: Fase;
  onMudou: () => void;
}) {
  const ap = entregavel.aprovacao_status ?? "pendente";
  const info = estadoEntregavel(ap);
  const [busy, setBusy] = useState(false);
  const [anexando, setAnexando] = useState(false);
  const [urlAnexo, setUrlAnexo] = useState(entregavel.entregavel_url ?? "");
  const [respondendo, setRespondendo] = useState(false);
  const [motivo, setMotivo] = useState("");

  async function acao(body: Record<string, unknown>) {
    setBusy(true);
    const res = await fetch(`/api/crm/projetos/${projetoId}/programa/${entregavel.id}/aprovacao`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify(body),
    });
    setBusy(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(typeof json?.error === "string" ? json.error : "Não foi possível concluir.");
      return false;
    }
    onMudou();
    return true;
  }

  async function salvarAnexo() {
    const ok = await acao({ acao: "anexar", entregavel_url: urlAnexo.trim() });
    if (ok) { setAnexando(false); toast.success("Arquivo anexado"); }
  }
  async function enviar() {
    const ok = await acao({ acao: ap === "rejeitado" ? "reenviar" : "enviar", entregavel_url: urlAnexo.trim() || undefined });
    if (ok) toast.success(ap === "rejeitado" ? "Reenviado para o cliente" : "Enviado para aprovação");
  }
  async function responder(decisao: "aprovado" | "rejeitado") {
    if (decisao === "rejeitado" && !motivo.trim()) { toast.error("Informe o motivo da reprovação."); return; }
    const ok = await acao({ acao: "responder", decisao, motivo: decisao === "rejeitado" ? motivo.trim() : undefined });
    if (ok) { setRespondendo(false); setMotivo(""); toast.success(decisao === "aprovado" ? "Aprovação registrada" : "Reprovação registrada"); }
  }

  const temArquivo = Boolean(entregavel.entregavel_url || urlAnexo.trim());

  return (
    <div className="rounded-xl border border-[#1d3a2c] bg-[#0f1d16] p-3" style={{ borderLeft: `3px solid ${info.cor}` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[#e6edf3]">{entregavel.nome}</p>
          <p className="mt-0.5 inline-flex items-center gap-1 text-[11px]" style={{ color: info.cor }}>
            {ap === "enviado" ? <Clock size={12} /> : ap === "aprovado" ? <Check size={12} /> : ap === "rejeitado" ? <X size={12} /> : null}
            {info.label}
          </p>
        </div>
        {entregavel.entregavel_url ? (
          <a href={entregavel.entregavel_url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs font-bold text-[#c9a24a]">
            Abrir →
          </a>
        ) : null}
      </div>

      {/* Motivo citado (rejeitado) — vem de aprovacao_motivo (A1) */}
      {ap === "rejeitado" && entregavel.aprovacao_motivo ? (
        <p className="mt-2 rounded-lg bg-[#1a0808] px-3 py-2 text-[11px] italic text-[#f3c4c4]">
          “{entregavel.aprovacao_motivo}”
        </p>
      ) : null}

      {/* Anexar arquivo (URL) */}
      {anexando ? (
        <div className="mt-3 space-y-2">
          <input
            type="url" value={urlAnexo} onChange={(e) => setUrlAnexo(e.target.value)}
            placeholder="URL do arquivo (Drive, Notion, link público)"
            className="w-full rounded-lg border border-[#1d3a2c] bg-[#16271e] px-3 py-2 text-sm text-[#e6edf3] outline-none focus:border-[#c9a24a]"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAnexando(false)} className="rounded-lg px-3 py-1.5 text-xs font-bold text-[#8b949e]">Cancelar</button>
            <button type="button" onClick={() => void salvarAnexo()} disabled={busy || !urlAnexo.trim()} className="rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50" style={{ background: "#003b26", color: "#c9a24a", border: "1px solid #c9a24a" }}>
              Salvar
            </button>
          </div>
        </div>
      ) : null}

      {/* Responder (registrar resposta do cliente) */}
      {respondendo ? (
        <div className="mt-3 space-y-2">
          <input
            type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo (obrigatório só para reprovar)"
            className="w-full rounded-lg border border-[#1d3a2c] bg-[#16271e] px-3 py-2 text-sm text-[#e6edf3] outline-none focus:border-[#c9a24a]"
          />
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => { setRespondendo(false); setMotivo(""); }} className="rounded-lg px-3 py-1.5 text-xs font-bold text-[#8b949e]">Cancelar</button>
            <button type="button" onClick={() => void responder("rejeitado")} disabled={busy} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50" style={{ background: "#1a0808", color: "#f87171", border: "1px solid #ef444455" }}>
              <X size={13} /> Reprovou
            </button>
            <button type="button" onClick={() => void responder("aprovado")} disabled={busy} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50" style={{ background: "#06280f", color: "#4ade80", border: "1px solid #22c55e55" }}>
              <Check size={13} /> Aprovou
            </button>
          </div>
        </div>
      ) : null}

      {/* Ações por estado */}
      {!anexando && !respondendo ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {!temArquivo ? (
            <button type="button" onClick={() => setAnexando(true)} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold text-[#c9a24a]" style={{ border: "1px solid #1d3a2c" }}>
              <Paperclip size={13} /> Anexar entregável
            </button>
          ) : null}
          {(ap === "pendente" && temArquivo) ? (
            <button type="button" onClick={() => void enviar()} disabled={busy} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50" style={{ background: "#003b26", color: "#c9a24a", border: "1px solid #c9a24a" }}>
              <Send size={13} /> Enviar para aprovação
            </button>
          ) : null}
          {ap === "enviado" ? (
            <button type="button" onClick={() => setRespondendo(true)} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold" style={{ background: "#003b26", color: "#c9a24a", border: "1px solid #c9a24a" }}>
              <Check size={13} /> Registrar resposta
            </button>
          ) : null}
          {ap === "rejeitado" ? (
            <button type="button" onClick={() => void enviar()} disabled={busy} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50" style={{ background: "#003b26", color: "#c9a24a", border: "1px solid #c9a24a" }}>
              <RotateCcw size={13} /> Reenviar com revisão
            </button>
          ) : null}
          {(temArquivo && ap !== "enviado") ? (
            <button type="button" onClick={() => { setUrlAnexo(entregavel.entregavel_url ?? ""); setAnexando(true); }} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold text-[#8b949e]" style={{ border: "1px solid #1d3a2c" }}>
              <Paperclip size={13} /> Trocar arquivo
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
