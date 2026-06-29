"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MessageSquare, LayoutList, GitBranch, FileText, HardHat, Mic, Plus } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { toast } from "@/components/crm/toast";
import {
  ESTAGIOS_PROJETO_FALLBACK_UI,
  COR_ESTAGIO_PROJETO,
  APROVACAO_PROJETO,
  COMODOS_SUGERIDOS,
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
  aprovacao_status?: string | null;
  entregavel_url?: string | null;
};

type Aba = "conversar" | "programa" | "funil" | "entregaveis" | "engenharia";

const ABAS: { id: Aba; label: string; Icon: typeof MessageSquare }[] = [
  { id: "conversar", label: "Conversar", Icon: MessageSquare },
  { id: "programa", label: "Programa", Icon: LayoutList },
  { id: "funil", label: "Funil", Icon: GitBranch },
  { id: "entregaveis", label: "Entregáveis", Icon: FileText },
  { id: "engenharia", label: "Engenharia", Icon: HardHat },
];

export default function ProjetoFichaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [projeto, setProjeto] = useState<Projeto | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [aba, setAba] = useState<Aba>("conversar");
  const [fases, setFases] = useState<Fase[]>([]);

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

  const estagio = projeto?.estagio || projeto?.status || "briefing";
  const corEstagio = COR_ESTAGIO_PROJETO[estagio] || "#6B7280";
  const aprov = APROVACAO_PROJETO[(projeto?.aprovacao_status ?? "sem_aprovacao") as AprovacaoProjetoStatus] ?? APROVACAO_PROJETO.sem_aprovacao;

  const comodos = useMemo(() => fases.filter((f) => (f.tipo ?? "comodo") === "comodo"), [fases]);
  const entregaveis = useMemo(() => fases.filter((f) => f.tipo === "fase"), [fases]);
  const totalPrograma = comodos.reduce((s, c) => s + (Number(c.metragem_m2) || 0), 0);

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

  async function adicionarComodo(nome: string) {
    const res = await fetch(`/api/crm/projetos/${id}/programa`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({ tipo: "comodo", itens: [{ nome }] }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(typeof json?.error === "string" ? json.error : "Não foi possível adicionar.");
      return;
    }
    toast.success(`${nome} adicionado ao programa`);
    void carregarFases();
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
                Use o copiloto para criar, mover de estágio ou montar o programa por voz ou texto.
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
              <div className="rounded-xl border border-[#c9a24a44] bg-[#1a1405] p-4">
                <p className="text-sm font-bold text-[#f0c869]">Aprovação aguardando o cliente</p>
                <p className="mt-1 text-xs text-[#f3e6c4]">
                  Reforce com um lembrete pelos Entregáveis quando achar oportuno.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* PROGRAMA (tipo='comodo') */}
        {aba === "programa" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {COMODOS_SUGERIDOS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => void adicionarComodo(c)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#1d3a2c] bg-[#0f1d16] px-3 py-1.5 text-xs font-bold text-[#c9a24a] hover:border-[#c9a24a66]"
                >
                  <Plus size={12} /> {c}
                </button>
              ))}
            </div>
            {comodos.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#1d3a2c] bg-[#0f1d16] p-6 text-center text-sm text-[#8b949e]">
                Programa vazio. Toque nos chips acima para montar os ambientes.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {comodos.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-xl border border-[#1d3a2c] bg-[#0f1d16] px-3 py-2.5">
                    <span className="text-sm font-bold text-[#e6edf3]">{c.nome}</span>
                    {c.metragem_m2 ? <span className="text-xs text-[#94a3b8]">{c.metragem_m2}m²</span> : null}
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-[#8b949e]">
              Total do programa: <strong className="text-[#e6edf3]">{totalPrograma || 0}m²</strong>
              {projeto.area_m2 ? <> · contratada: <strong className="text-[#e6edf3]">{projeto.area_m2}m²</strong></> : null}
            </p>
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

        {/* ENTREGÁVEIS (tipo='fase') */}
        {aba === "entregaveis" ? (
          <div className="space-y-3">
            {entregaveis.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#1d3a2c] bg-[#0f1d16] p-6 text-center text-sm text-[#8b949e]">
                Nenhum entregável ainda. Os entregáveis (estudos, anteprojeto, executivo) aparecem aqui por etapa.
              </p>
            ) : (
              entregaveis.map((e) => {
                const ap = (e.aprovacao_status ?? "pendente") as string;
                const cor = ap === "aprovado" ? "#22c55e" : ap === "enviado" ? "#c9a24a" : ap === "rejeitado" ? "#ef4444" : "#8b949e";
                return (
                  <div key={e.id} className="flex items-center justify-between rounded-xl border border-[#1d3a2c] bg-[#0f1d16] px-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#e6edf3]">{e.nome}</p>
                      <p className="text-[11px]" style={{ color: cor }}>{ap}</p>
                    </div>
                    {e.entregavel_url ? (
                      <a href={e.entregavel_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-[#c9a24a]">
                        Abrir →
                      </a>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
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
    </div>
  );
}
