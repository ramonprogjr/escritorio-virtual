"use client";
import dynamic from "next/dynamic";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Phone, Share2, Briefcase, StickyNote, XCircle, Ban, Bot, User } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";
import { PipelineTabsBar } from "@/components/crm/pipelines/PipelineTabsBar";
import { useNarrowViewport } from "@/hooks/useNarrowViewport";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { estagioParaColunaKanban } from "@/lib/crm/estagio-map";
import { patchLeadCrm } from "@/lib/crm/patch-lead-client";
import { ESTAGIOS_FALLBACK_UI, limparNomePipeline } from "@/lib/crm/pipeline-defaults";
import { FUNIL_LEAD_ETAPAS, MOTIVOS_PERDA, MOTIVOS_PERDA_LABEL } from "@/lib/crm/pipelines";
import { labelMercadoPrefixo } from "@/lib/crm/negocio-cadastro";
import { DirecionarLeadDrawer } from "@/components/crm/DirecionarLeadDrawer";
import { EncaminhamentosPendentesPanel } from "@/components/crm/leads/EncaminhamentosPendentesPanel";

const LeadRapidoSideover = dynamic(
  () =>
    import("@/components/crm/leads/LeadRapidoSideover").then((m) => ({
      default: m.LeadRapidoSideover,
    })),
  { ssr: false }
);

const LeadKanbanCard = dynamic(
  () =>
    import("@/components/crm/leads/LeadKanbanCard").then((m) => ({
      default: m.LeadKanbanCard,
    })),
  { ssr: false }
);

const PipelineConfigSideover = dynamic(
  () =>
    import("@/components/crm/leads/PipelineConfigSideover").then((m) => ({
      default: m.PipelineConfigSideover,
    })),
  { ssr: false }
);

// ─── Types ────────────────────────────────────────────────────────────────────

type Lead = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  origem: string | null;
  campanha: string | null;
  estagio: string;
  estagio_funil?: string | null;
  score: number;
  valor_estimado: number;
  agente_responsavel: string | null;
  humano_responsavel: string | null;
  proxima_acao: string | null;
  data_proxima_acao: string | null;
  interesse_principal?: string | null;
  motivo_perda: string | null;
  tags: string[];
  criado_em: string;
  atualizado_em: string;
  pessoa_id?: string | null;
  codigo?: string | null;
  metadata?: unknown;
  pipeline_id?: string | null;
  /** Enriquecimento (hub_pessoas / view) */
  _pessoa_codigo?: string | null;
  _email_exibicao?: string | null;
  ultima_mensagem_fila?: string | null;
  ultima_mensagem_fila_em?: string | null;
  pessoa_cidade?: string | null;
  pessoa_estado?: string | null;
};

type EstagioUi = { id: string; label: string; color: string };

type PipelineUi = {
  id: string;
  slug: string;
  nome: string;
  mercado_sigla: string | null;
  estagios: { slug: string; label: string; cor: string; ativo: boolean; ordem?: number }[];
};

type Atividade = {
  id: string;
  tipo: string;
  descricao: string;
  feito_por: string;
  feito_por_tipo: string;
  criado_em: string;
};

type Nota = {
  id: string;
  conteudo: string;
  criado_por: string;
  criado_em: string;
};

type Memoria = {
  id: string;
  chave: string;
  valor: string;
  confianca: number;
  criado_em: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ESTAGIOS_FALLBACK: EstagioUi[] = ESTAGIOS_FALLBACK_UI.map((e) => ({
  id: e.id,
  label: e.label,
  color: e.color,
}));

const ORIGENS_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp", instagram: "Instagram", meta_ads: "Meta Ads",
  google_ads: "Google Ads", linkedin: "LinkedIn", site: "Site",
  indicacao: "Indicação", outro: "Outro",
};
const ORIGENS_COLOR: Record<string, string> = {
  whatsapp: "#25D366", instagram: "#E1306C", meta_ads: "#1877F2",
  google_ads: "#EA4335", linkedin: "#0A66C2", site: "#c9a24a",
  indicacao: "#F59E0B", outro: "#6B7280",
};
const ATIVIDADE_ICON: Record<string, string> = {
  mensagem: "💬", ligacao: "📞", email: "📧", reuniao: "📅",
  nota: "📝", proposta: "📄", follow_up: "🔄", status_change: "📍", ia_acao: "🤖",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function moeda(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);
}

function tempo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
}

function borderColor(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 5) return "#22C55E";
  if (m < 15) return "#EAB308";
  return "#EF4444";
}

function isPipelineGlobal(pipe: PipelineUi | null): boolean {
  if (!pipe) return true;
  return (
    pipe.slug === "leads-global" ||
    pipe.slug === "lead-global" ||
    /^leads?\s+[—-]\s+pipeline global$/i.test(pipe.nome)
  );
}

/** Máximo de cards por faixa na Caixa antes de "ver todos". */
const LIMITE_CAIXA = 12;

/** Lê a metadata do lead como objeto seguro. */
function leadMetaObj(lead: Lead): Record<string, unknown> {
  const m = lead.metadata;
  return m && typeof m === "object" && !Array.isArray(m) ? (m as Record<string, unknown>) : {};
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LeadsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setSlot } = useCrmHeaderSlot();
  const narrow = useNarrowViewport();
  const isMobile = narrow !== false;
  const [leads, setLeads] = useState<Lead[]>([]);
  const [view, setView] = useState<"kanban" | "lista" | "caixa">("caixa");
  const [verTodos, setVerTodos] = useState<Record<string, boolean>>({});
  const [busca, setBusca] = useState("");
  const [filtroEstagio, setFiltroEstagio] = useState("");
  const [detalhe, setDetalhe] = useState<Lead | null>(null);
  const [tabDetalhe, setTabDetalhe] = useState<"info" | "timeline" | "notas" | "memorias">("info");
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [memorias, setMemorias] = useState<Memoria[]>([]);
  const [novaNota, setNovaNota] = useState("");
  const [motivoPerda, setMotivoPerda] = useState("");
  const [motivoPerdaOutro, setMotivoPerdaOutro] = useState("");
  const [confirmandoPerda, setConfirmandoPerda] = useState(false);
  const [perdaComoSpam, setPerdaComoSpam] = useState(false);
  const [encaminharLead, setEncaminharLead] = useState<Lead | null>(null);
  const [convertendoIds, setConvertendoIds] = useState<Set<string>>(new Set());
  const [leadDragId, setLeadDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [leadRapidoOpen, setLeadRapidoOpen] = useState(false);
  const [pipelineConfigOpen, setPipelineConfigOpen] = useState(false);
  const [acaoErro, setAcaoErro] = useState<string | null>(null);
  const [pipelines, setPipelines] = useState<PipelineUi[]>([]);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [estagiosKanban, setEstagiosKanban] = useState<EstagioUi[]>(ESTAGIOS_FALLBACK);
  const [sucessoLead, setSucessoLead] = useState<string | null>(null);

  const carregarPipeline = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/pipelines?tipo=lead", {
        headers: internalApiHeaders(),
      });
      const json = await res.json();
      const list = (json.data || []) as PipelineUi[];
      if (!list.length) return;
      setPipelines(list);
      setPipelineId((prev) => {
        if (prev && list.some((p) => p.id === prev)) return prev;
        return (
          list.find((p) => p.slug === "leads-global" || p.slug === "lead-global")?.id ||
          list[0]?.id ||
          null
        );
      });
    } catch {
      /* fallback ESTAGIOS_FALLBACK */
    }
  }, []);

  const carregar = useCallback(async () => {
    const vw = await supabase
      .from("vw_hub_leads_crm_enriquecido")
      .select("*")
      .order("criado_em", { ascending: false });

    if (!vw.error && vw.data) {
      const rawRows = vw.data as Record<string, unknown>[];
      const ids = rawRows
        .map((r) => (r.id != null ? String(r.id) : null))
        .filter(Boolean) as string[];
      const pipelineMap = new Map<string, string | null>();

      if (ids.length) {
        const { data: baseRows } = await supabase
          .from("hub_leads_crm")
          .select("id, pipeline_id")
          .in("id", ids);
        for (const row of baseRows || []) {
          pipelineMap.set(String(row.id), row.pipeline_id != null ? String(row.pipeline_id) : null);
        }
      }

      const merged: Lead[] = rawRows.map((r) => {
        const {
          pessoa_codigo,
          pessoa_nome_completo: _pn,
          email_exibicao,
          ...base
        } = r;
        const leadId = r.id != null ? String(r.id) : null;
        const emailDisp =
          email_exibicao != null && String(email_exibicao).trim()
            ? String(email_exibicao).trim()
            : null;
        return {
          ...(base as Omit<Lead, "_pessoa_codigo" | "_email_exibicao">),
          _pessoa_codigo: pessoa_codigo != null ? String(pessoa_codigo) : null,
          _email_exibicao: emailDisp,
          pipeline_id:
            r.pipeline_id != null
              ? String(r.pipeline_id)
              : (leadId ? pipelineMap.get(leadId) ?? null : null),
          ultima_mensagem_fila:
            r.ultima_mensagem_fila != null ? String(r.ultima_mensagem_fila) : null,
          ultima_mensagem_fila_em:
            r.ultima_mensagem_fila_em != null ? String(r.ultima_mensagem_fila_em) : null,
          pessoa_cidade: r.pessoa_cidade != null ? String(r.pessoa_cidade) : null,
          pessoa_estado: r.pessoa_estado != null ? String(r.pessoa_estado) : null,
          metadata: r.metadata,
        };
      });
      setLeads(merged);
      return;
    }

    const { data } = await supabase.from("hub_leads_crm").select("*").order("criado_em", { ascending: false });
    const raw = (data || []) as Lead[];
    const pids = [...new Set(raw.map((r) => r.pessoa_id).filter(Boolean))] as string[];
    const map = new Map<string, { codigo: string | null; email: string | null }>();
    if (pids.length) {
      const { data: pes } = await supabase.from("hub_pessoas").select("id, codigo, email").in("id", pids);
      for (const p of pes || []) {
        map.set(String(p.id), {
          codigo: p.codigo != null ? String(p.codigo) : null,
          email: p.email != null ? String(p.email) : null,
        });
      }
    }
    const merged: Lead[] = raw.map((r) => {
      const pe = r.pessoa_id ? map.get(r.pessoa_id) : undefined;
      const emailLead = (r.email && String(r.email).trim()) || "";
      const emailP = (pe?.email && String(pe.email).trim()) || "";
      return {
        ...r,
        _pessoa_codigo: pe?.codigo ?? null,
        _email_exibicao: emailLead || emailP || null,
      };
    });
    setLeads(merged);
  }, []);

  useEffect(() => {
    const est = searchParams.get("estagio");
    const v = searchParams.get("view");
    if (est) setFiltroEstagio(est);
    if (v === "kanban" || v === "lista" || v === "caixa") setView(v);
    else if (isMobile) setView("caixa");
    if (searchParams.get("novo") === "1") {
      setLeadRapidoOpen(true);
      const p = new URLSearchParams(searchParams.toString());
      p.delete("novo");
      const q = p.toString();
      router.replace(q ? `/crm/leads?${q}` : "/crm/leads");
    }
  }, [searchParams, isMobile, router]);

  useEffect(() => {
    void carregarPipeline();
  }, [carregarPipeline]);

  const pipelineAtivo = useMemo(
    () => pipelines.find((p) => p.id === pipelineId) ?? null,
    [pipelines, pipelineId]
  );

  useEffect(() => {
    const cols =
      pipelineAtivo?.estagios
        ?.filter((e) => e.ativo !== false)
        .sort((a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0))
        .map((e) => ({ id: e.slug, label: e.label, color: e.cor || "#6B7280" })) ?? [];
    setEstagiosKanban(cols.length ? cols : ESTAGIOS_FALLBACK);
  }, [pipelineAtivo]);

  useEffect(() => {
    carregar();
    const ch = supabase.channel("leads_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_leads_crm" }, carregar)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [carregar]);

  async function abrirDetalhe(lead: Lead) {
    setDetalhe(lead);
    setTabDetalhe("info");
    setConfirmandoPerda(false);
    setMotivoPerda("");
    const [{ data: a }, { data: n }, { data: m }] = await Promise.all([
      supabase.from("hub_atividades").select("*").eq("lead_id", lead.id).order("criado_em", { ascending: false }).limit(30),
      supabase.from("hub_notas").select("*").eq("lead_id", lead.id).order("criado_em", { ascending: false }),
      supabase.from("hub_memorias_lead").select("*").eq("lead_id", lead.id).order("criado_em", { ascending: false }),
    ]);
    setAtividades((a || []) as Atividade[]);
    setNotas((n || []) as Nota[]);
    setMemorias((m || []) as Memoria[]);
  }

  function mostrarErroAcao(msg: string) {
    setAcaoErro(msg);
    window.setTimeout(() => setAcaoErro((a) => (a === msg ? null : a)), 5000);
  }

  async function moverEstagio(leadId: string, novoEstagio: string, extra?: Record<string, unknown>) {
    const leadAtual = leads.find((l) => l.id === leadId);
    const res = await patchLeadCrm(leadId, {
      estagio: novoEstagio,
      _estagio_anterior: leadAtual?.estagio,
      ...extra,
    });
    if (!res.ok) {
      mostrarErroAcao(res.error || "Não foi possível mover o lead.");
      return false;
    }
    const data = res.data as { estagio?: string; estagio_funil?: string };
    const est = String(data.estagio_funil ?? data.estagio ?? novoEstagio);
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, estagio: est, estagio_funil: est } : l)));
    if (detalhe?.id === leadId) setDetalhe((d) => (d ? { ...d, estagio: est, estagio_funil: est } : null));
    return true;
  }

  async function converterNegocio(lead: Lead) {
    if (convertendoIds.has(lead.id)) return;
    setConvertendoIds((prev) => new Set(prev).add(lead.id));
    const res = await fetch(`/api/crm/leads/${encodeURIComponent(lead.id)}/converter-negocio`, {
      method: "POST",
      credentials: "include",
      headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const json = await res.json().catch(() => ({}));
    setConvertendoIds((prev) => {
      const next = new Set(prev);
      next.delete(lead.id);
      return next;
    });
    if (!res.ok) {
      mostrarErroAcao(typeof json?.error === "string" ? json.error : "Não foi possível criar o negócio.");
      return;
    }
    const negocioId = json?.data?.id as string | undefined;
    await moverEstagio(lead.id, "convertido_negocio");
    void carregar();
    if (negocioId) router.push(`/crm/negocios/${negocioId}`);
    setDetalhe(null);
  }

  async function marcarGanho() {
    if (!detalhe) return;
    await converterNegocio(detalhe);
  }

  async function marcarPerdido() {
    const motivo =
      motivoPerda === "outro" ? motivoPerdaOutro.trim() : motivoPerda.trim();
    if (!detalhe || !motivo) return;
    const estagio = perdaComoSpam ? "spam_invalido" : "perdido";
    const ok = await moverEstagio(detalhe.id, estagio, { motivo_perda: motivo });
    if (!ok) return;
    setDetalhe(null);
    setMotivoPerda("");
    setConfirmandoPerda(false);
    setPerdaComoSpam(false);
    void carregar();
  }

  async function adicionarNota() {
    if (!detalhe || !novaNota.trim()) return;
    // Grava pela API guardada (requireCrmComercial + tenant) — nunca insert anon órfão.
    const res = await fetch(`/api/crm/leads/${encodeURIComponent(detalhe.id)}/nota`, {
      method: "POST",
      credentials: "include",
      headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ descricao: novaNota.trim() }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      mostrarErroAcao(typeof json?.error === "string" ? json.error : "Não foi possível salvar a nota.");
      return;
    }
    if (json?.data) setNotas(prev => [json.data as Nota, ...prev]);
    setNovaNota("");
  }

  const leadsDoPipeline = leads.filter((l) => {
    if (!pipelineAtivo) return true;
    if (isPipelineGlobal(pipelineAtivo)) return true;
    return l.pipeline_id === pipelineAtivo.id;
  });

  const filtrados = leadsDoPipeline.filter(l => {
    if (
      busca &&
      !l.nome.toLowerCase().includes(busca.toLowerCase()) &&
      !(l.telefone || "").includes(busca) &&
      !(l.codigo || "").toLowerCase().includes(busca.toLowerCase()) &&
      !(l._pessoa_codigo || "").toLowerCase().includes(busca.toLowerCase())
    ) {
      return false;
    }
    if (filtroEstagio && estagioParaColunaKanban(l.estagio) !== filtroEstagio) return false;
    return true;
  });

  // Caixa de Oportunidades — faixas de urgência (o que precisa de mim agora)
  const caixaLanes = useMemo(() => {
    const exclui = new Set(["ganho", "perdido", "spam_invalido", "convertido_negocio"]);
    const agora: Lead[] = [];
    const hojeLeads: Lead[] = [];
    const aguardando: Lead[] = [];
    for (const l of filtrados) {
      if (exclui.has(l.estagio)) continue;
      if (l.estagio === "encaminhado") {
        aguardando.push(l);
        continue;
      }
      const idade = Date.now() - new Date(l.atualizado_em).getTime();
      if (idade > 86_400_000) agora.push(l);
      else hojeLeads.push(l);
    }
    agora.sort((a, b) => new Date(a.atualizado_em).getTime() - new Date(b.atualizado_em).getTime());
    hojeLeads.sort((a, b) => new Date(b.atualizado_em).getTime() - new Date(a.atualizado_em).getTime());
    return { agora, hoje: hojeLeads, aguardando };
  }, [filtrados]);

  const hoje = new Date().toDateString();
  // Etapas que saíram da fila ATIVA do dono: fechadas OU já encaminhadas ao parceiro
  // (encaminhado = aguardando o parceiro, NÃO "sem resposta minha"). Os KPIs do topo e o
  // board precisam do mesmo denominador — senão o número mente (board vazio mas "6 sem resposta").
  const foraDaFilaAtiva = new Set(["ganho", "perdido", "spam_invalido", "convertido_negocio", "encaminhado"]);
  const ativosNaFila = leadsDoPipeline.filter((l) => !foraDaFilaAtiva.has(l.estagio));
  const encaminhados = leadsDoPipeline.filter((l) => l.estagio === "encaminhado").length;
  const semResposta = ativosNaFila.filter(l => Date.now() - new Date(l.atualizado_em).getTime() > 86_400_000).length;
  const emRisco = ativosNaFila.filter(l => Date.now() - new Date(l.atualizado_em).getTime() > 3_600_000).reduce((s, l) => s + l.valor_estimado, 0);
  const pipeline = ativosNaFila.reduce((s, l) => s + l.valor_estimado, 0);

  const botaoNovoLead = useMemo(
    () => (
      <button
        type="button"
        onClick={() => setLeadRapidoOpen(true)}
        className="min-h-11 shrink-0 rounded-lg px-4 py-2 text-sm font-bold min-[480px]:min-h-10"
        style={{ background: "#003b26", color: "#c9a24a", border: "none", cursor: "pointer" }}
      >
        + Novo lead
      </button>
    ),
    []
  );

  useEffect(() => {
    if (isMobile) {
      setSlot(null);
      return;
    }
    setSlot({
      path: pathname,
      subtitle: `${limparNomePipeline(pipelineAtivo?.nome) || "Pipeline de Leads"} · ${leadsDoPipeline.length} leads`,
      actions: (
        <>
          {botaoNovoLead}
          <div className="inline-flex w-full rounded-lg bg-[#16271e] p-0.5 min-[480px]:w-auto">
            <button
              type="button"
              onClick={() => setView("caixa")}
              className={`min-h-11 flex-1 touch-manipulation rounded-md px-3 py-2 text-xs font-bold transition-colors min-[480px]:min-h-10 min-[480px]:flex-none min-[480px]:py-1.5 ${view === "caixa" ? "bg-[#1d3a2c] text-white" : "text-[#8b949e] hover:text-[#e6edf3]"}`}
            >
              Caixa
            </button>
            <button
              type="button"
              onClick={() => setView("kanban")}
              className={`min-h-11 flex-1 touch-manipulation rounded-md px-3 py-2 text-xs font-bold transition-colors min-[480px]:min-h-10 min-[480px]:flex-none min-[480px]:py-1.5 ${view === "kanban" ? "bg-[#1d3a2c] text-white" : "text-[#8b949e] hover:text-[#e6edf3]"}`}
            >
              Kanban
            </button>
            <button
              type="button"
              onClick={() => setView("lista")}
              className={`min-h-11 flex-1 touch-manipulation rounded-md px-3 py-2 text-xs font-bold transition-colors min-[480px]:min-h-10 min-[480px]:flex-none min-[480px]:py-1.5 ${view === "lista" ? "bg-[#1d3a2c] text-white" : "text-[#8b949e] hover:text-[#e6edf3]"}`}
            >
              Lista
            </button>
          </div>
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar lead..."
            className="w-full min-h-11 min-w-0 rounded-lg border border-[#1d3a2c] bg-[#16271e] px-3 py-2 text-sm text-[#e6edf3] outline-none placeholder:text-[#6e7681] focus:border-[#c9a24a] min-[480px]:min-h-10 min-[480px]:w-44"
          />
          <select
            value={filtroEstagio}
            onChange={e => setFiltroEstagio(e.target.value)}
            className="w-full min-h-11 rounded-lg border border-[#1d3a2c] bg-[#16271e] px-3 py-2 text-sm text-[#e6edf3] outline-none min-[480px]:min-h-10 min-[480px]:w-[11.5rem]"
          >
            <option value="">Todos os estágios</option>
            {estagiosKanban.map(e => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setPipelineConfigOpen(true)}
            className="min-h-11 shrink-0 rounded-lg border border-[#1d3a2c] bg-[#16271e] px-3 py-2 text-xs font-bold text-[#8b949e] hover:text-[#e6edf3] min-[480px]:min-h-10"
            title="Configurar pipeline"
          >
            Pipeline
          </button>
        </>
      ),
    });
    return () => setSlot(null);
  }, [pathname, setSlot, pipelineAtivo, leadsDoPipeline.length, view, busca, filtroEstagio, isMobile, botaoNovoLead, estagiosKanban]);

  const headerControls = (
    <>
      {botaoNovoLead}
      <div className="inline-flex w-full rounded-lg bg-[#16271e] p-0.5 min-[480px]:w-auto">
        <button
          type="button"
          onClick={() => setView("caixa")}
          className={`min-h-11 flex-1 touch-manipulation rounded-md px-3 py-2 text-xs font-bold transition-colors min-[480px]:min-h-10 min-[480px]:flex-none min-[480px]:py-1.5 ${view === "caixa" ? "bg-[#1d3a2c] text-white" : "text-[#8b949e] hover:text-[#e6edf3]"}`}
        >
          Caixa
        </button>
        <button
          type="button"
          onClick={() => setView("kanban")}
          className={`min-h-11 flex-1 touch-manipulation rounded-md px-3 py-2 text-xs font-bold transition-colors min-[480px]:min-h-10 min-[480px]:flex-none min-[480px]:py-1.5 ${view === "kanban" ? "bg-[#1d3a2c] text-white" : "text-[#8b949e] hover:text-[#e6edf3]"}`}
        >
          Kanban
        </button>
        <button
          type="button"
          onClick={() => setView("lista")}
          className={`min-h-11 flex-1 touch-manipulation rounded-md px-3 py-2 text-xs font-bold transition-colors min-[480px]:min-h-10 min-[480px]:flex-none min-[480px]:py-1.5 ${view === "lista" ? "bg-[#1d3a2c] text-white" : "text-[#8b949e] hover:text-[#e6edf3]"}`}
        >
          Lista
        </button>
      </div>
      <input
        value={busca}
        onChange={e => setBusca(e.target.value)}
        placeholder="Buscar lead..."
        className="w-full min-h-11 min-w-0 rounded-lg border border-[#1d3a2c] bg-[#16271e] px-3 py-2 text-sm text-[#e6edf3] outline-none placeholder:text-[#6e7681] focus:border-[#c9a24a] min-[480px]:min-h-10 min-[480px]:w-44"
      />
      <select
        value={filtroEstagio}
        onChange={e => setFiltroEstagio(e.target.value)}
        className="w-full min-h-11 rounded-lg border border-[#1d3a2c] bg-[#16271e] px-3 py-2 text-sm text-[#e6edf3] outline-none min-[480px]:min-h-10 min-[480px]:w-[11.5rem]"
      >
        <option value="">Todos os estágios</option>
        {estagiosKanban.map(e => (
          <option key={e.id} value={e.id}>
            {e.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setPipelineConfigOpen(true)}
        className="min-h-11 shrink-0 rounded-lg border border-[#1d3a2c] bg-[#16271e] px-3 py-2 text-xs font-bold text-[#8b949e] hover:text-[#e6edf3] min-[480px]:min-h-10"
      >
        Pipeline
      </button>
    </>
  );

  const pipelineTabs = pipelines.length > 0 ? (
    <PipelineTabsBar
      pipelines={pipelines}
      activePipelineId={pipelineId}
      onSelect={setPipelineId}
    />
  ) : null;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0a140f]">

      {sucessoLead && (
        <div
          role="status"
          className="mx-4 mt-3 flex items-start justify-between gap-3 rounded-lg border border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.12)] px-3 py-2 text-sm text-[#3fb950]"
        >
          <span>{sucessoLead}</span>
          <button
            type="button"
            onClick={() => setSucessoLead(null)}
            className="border-0 bg-transparent text-lg leading-none text-[#8b949e] hover:text-white"
            aria-label="Fechar aviso"
          >
            ×
          </button>
        </div>
      )}

      <div className="mx-4 mt-3">
        <EncaminhamentosPendentesPanel onChanged={() => void carregar()} />
      </div>

      {pipelineTabs}

      {isMobile && (
        <div className="relative z-10 shrink-0 space-y-2 border-b border-[#1d3a2c] bg-[#0f1d16] px-3 py-3">
          <div>
            <h1 className="text-base font-bold text-[#e6edf3]">{limparNomePipeline(pipelineAtivo?.nome) || "Leads"}</h1>
            <p className="text-[11px] text-[#8b949e]">{leadsDoPipeline.length} leads · tempo real</p>
          </div>
          <div className="flex flex-col gap-2">{headerControls}</div>
        </div>
      )}

      {/* ─── METRICS ─── */}
      <div className="grid grid-cols-2 gap-px sm:grid-cols-5 flex-shrink-0 bg-[#1d3a2c]">
        {[
          { label: "Leads Hoje", value: String(leadsDoPipeline.filter(l => new Date(l.criado_em).toDateString() === hoje).length), cor: "#c9a24a" },
          { label: "Sem Resposta +24h", value: String(semResposta), cor: semResposta > 0 ? "#EF4444" : "#22C55E" },
          { label: "Em Risco +1h", value: emRisco > 0 ? moeda(emRisco) : "—", cor: emRisco > 0 ? "#EAB308" : "#6B7280" },
          { label: "Encaminhados", value: String(encaminhados), cor: encaminhados > 0 ? "#c9a24a" : "#6B7280" },
          { label: "Pipeline Total", value: moeda(pipeline), cor: "#22C55E" },
        ].map(m => (
          <div key={m.label} className="bg-[#0f1d16] px-3 py-2.5 sm:px-5">
            <p className="mb-0.5 text-xs text-[#8b949e]">{m.label}</p>
            <p className="text-base font-black sm:text-lg" style={{ color: m.cor }}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* ─── MAIN ─── */}
      <div className="flex-1 overflow-hidden">
        {view === "caixa" ? (

          /* CAIXA DE OPORTUNIDADES — superfície de trabalho acionável */
          <div className="h-full overflow-y-auto p-4 pb-24 space-y-6">
            {([
              { key: "agora", label: "Agora", sub: "esfriando — resgate já", cor: "#EF4444", leads: caixaLanes.agora },
              { key: "hoje", label: "Hoje", sub: "no ritmo", cor: "#EAB308", leads: caixaLanes.hoje },
              { key: "aguardando", label: "Aguardando", sub: "com outro responsável", cor: "#6B7280", leads: caixaLanes.aguardando },
            ] as const).map((lane) => {
              const verMais = verTodos[lane.key] === true;
              const visiveis = verMais ? lane.leads : lane.leads.slice(0, LIMITE_CAIXA);
              const restantes = lane.leads.length - visiveis.length;
              return (
              <section key={lane.key}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: lane.cor }} aria-hidden />
                  <h2 className="text-sm font-bold text-[#e6edf3]">{lane.label}</h2>
                  <span className="text-xs text-[#8b949e]">{lane.sub}</span>
                  <span className="ml-auto rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: lane.cor + "22", color: lane.cor }}>
                    {lane.leads.length}
                  </span>
                </div>
                {lane.leads.length === 0 ? (
                  <p className="px-1 pb-1 text-xs text-[#8b949e]">Nada aqui — bom sinal.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {visiveis.map((lead) => {
                      const est = estagiosKanban.find((e) => e.id === estagioParaColunaKanban(lead.estagio));
                      const tel = (lead.telefone || "").replace(/\D/g, "");
                      const meta = leadMetaObj(lead);
                      const mercadoPref =
                        (typeof meta.mercado_principal === "string" && meta.mercado_principal) ||
                        (Array.isArray(meta.mercados) && typeof meta.mercados[0] === "string"
                          ? (meta.mercados[0] as string)
                          : "");
                      const mercadoLabel = mercadoPref ? labelMercadoPrefixo(mercadoPref) || mercadoPref : null;
                      const cidade =
                        (typeof meta.cidade === "string" && meta.cidade) || lead.pessoa_cidade || "";
                      const parceiroNome =
                        typeof meta.parceiro_nome === "string" && meta.parceiro_nome ? meta.parceiro_nome : "";
                      return (
                        <div
                          key={lead.id}
                          className="flex flex-col rounded-xl border border-[#1d3a2c] bg-[#0f1d16] p-3 transition-colors hover:border-[#484f58]"
                          style={{ borderLeftWidth: 3, borderLeftColor: borderColor(lead.atualizado_em) }}
                        >
                          <button
                            type="button"
                            onClick={() => router.push(`/crm/leads/${lead.id}`)}
                            className="cursor-pointer text-left"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="truncate text-sm font-bold text-[#e6edf3]">{lead.nome}</p>
                              {est && (
                                <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: est.color + "22", color: est.color }}>
                                  {est.label}
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              {lead.origem && (
                                <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ background: (ORIGENS_COLOR[lead.origem] || "#6B7280") + "25", color: ORIGENS_COLOR[lead.origem] || "#9CA3AF" }}>
                                  {ORIGENS_LABEL[lead.origem] || lead.origem}
                                </span>
                              )}
                              {mercadoLabel && (
                                <span className="rounded-full bg-[#c9a24a]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#c9a24a]">
                                  {mercadoLabel}
                                </span>
                              )}
                              <span className="text-[11px] text-[#8b949e]">{tempo(lead.atualizado_em)} parado</span>
                              {lead.valor_estimado > 0 && (
                                <span className="text-[11px] font-bold text-[#22C55E]">{moeda(lead.valor_estimado)}</span>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px]">
                              {lead.humano_responsavel ? (
                                <span className="inline-flex items-center gap-1 font-semibold text-[#22C55E]">
                                  <User size={11} strokeWidth={2.5} aria-hidden /> {lead.humano_responsavel}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-amber-300">
                                  <Bot size={11} strokeWidth={2.5} aria-hidden /> IA
                                  {lead.agente_responsavel ? ` · ${lead.agente_responsavel}` : ""}
                                </span>
                              )}
                              {cidade && <span className="text-[#8b949e]">{cidade}</span>}
                              {parceiroNome && (
                                <span className="inline-flex items-center gap-1 text-[#fcd34d]">→ {parceiroNome}</span>
                              )}
                            </div>
                            {(lead.interesse_principal || lead.ultima_mensagem_fila) && (
                              <p className="mt-1.5 line-clamp-2 text-xs text-[#8b949e]">
                                {lead.interesse_principal || `“${lead.ultima_mensagem_fila}”`}
                              </p>
                            )}
                          </button>
                          <div className="mt-2.5 flex gap-1.5">
                            {tel && (
                              <a
                                href={`https://wa.me/55${tel}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex flex-1 cursor-pointer items-center justify-center rounded-lg bg-[#25D366]/15 py-1.5 text-xs font-bold text-[#25D366] transition-colors hover:bg-[#25D366]/25"
                              >
                                Responder
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => void converterNegocio(lead)}
                              disabled={convertendoIds.has(lead.id)}
                              className="inline-flex flex-1 cursor-pointer items-center justify-center rounded-lg border border-[#1d3a2c] py-1.5 text-xs font-bold text-[#c9a24a] transition-colors hover:border-[#c9a24a]/50 disabled:opacity-40"
                            >
                              {convertendoIds.has(lead.id) ? "Criando…" : "Negócio"}
                            </button>
                            <button
                              type="button"
                              onClick={() => router.push(`/crm/leads/${lead.id}`)}
                              className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-[#1d3a2c] px-2.5 py-1.5 text-xs font-bold text-[#8b949e] transition-colors hover:text-[#e6edf3]"
                            >
                              Ficha
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {restantes > 0 ? (
                      <button
                        type="button"
                        onClick={() => setVerTodos((v) => ({ ...v, [lane.key]: true }))}
                        className="cursor-pointer rounded-xl border border-dashed border-[#1d3a2c] py-2.5 text-xs font-bold text-[#c9a24a] transition-colors hover:border-[#c9a24a]/50 sm:col-span-2 lg:col-span-3"
                      >
                        +{restantes} pendentes — ver todos
                      </button>
                    ) : verMais && lane.leads.length > LIMITE_CAIXA ? (
                      <button
                        type="button"
                        onClick={() => setVerTodos((v) => ({ ...v, [lane.key]: false }))}
                        className="cursor-pointer rounded-xl border border-dashed border-[#1d3a2c] py-2.5 text-xs font-bold text-[#8b949e] transition-colors hover:text-[#e6edf3] sm:col-span-2 lg:col-span-3"
                      >
                        ver menos
                      </button>
                    ) : null}
                  </div>
                )}
              </section>
              );
            })}
            {caixaLanes.agora.length === 0 && caixaLanes.hoje.length === 0 && caixaLanes.aguardando.length === 0 && (
              <p className="py-12 text-center text-sm text-[#8b949e]">Nenhum lead ativo nesta caixa.</p>
            )}
          </div>

        ) : view === "kanban" ? (

          /* KANBAN */
          <div
            className={`flex h-full overflow-x-auto ${isMobile ? "snap-x snap-mandatory scroll-pl-3 gap-2.5 px-3 py-3 scrollbar-none" : "gap-3 p-4"}`}
          >
            {estagiosKanban.map(est => {
              const col = filtrados.filter((l) => estagioParaColunaKanban(l.estagio) === est.id);
              const total = col.reduce((s, l) => s + l.valor_estimado, 0);
              return (
                <div
                  key={est.id}
                  className={`flex flex-shrink-0 flex-col ${isMobile ? "w-[clamp(11rem,72vw,18rem)] snap-start" : "min-w-[300px] w-[300px]"}`}
                >
                  {/* Column header */}
                  <div className="rounded-t-xl px-3 py-2.5" style={{ backgroundColor: est.color + "1A", borderLeft: `3px solid ${est.color}`, borderTop: `1px solid ${est.color}40`, borderRight: `1px solid ${est.color}40` }}>
                    <div className="flex items-center justify-between">
                      <span className="text-white font-bold text-xs">{est.label}</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: est.color + "40" }}>{col.length}</span>
                    </div>
                    {total > 0 && <p className="text-xs mt-0.5 font-bold" style={{ color: est.color }}>{moeda(total)}</p>}
                  </div>
                  {/* Cards */}
                  <div className="flex-1 space-y-2 overflow-y-auto rounded-b-xl border border-t-0 border-[#1d3a2c] bg-[#0f1d16]/60 p-2 transition-colors"
                    style={{ minHeight: 80, backgroundColor: dragOver === est.id ? est.color + "12" : undefined }}
                    onDragOver={e => { e.preventDefault(); setDragOver(est.id); }}
                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
                    onDrop={e => { e.preventDefault(); const lid = e.dataTransfer.getData("leadId"); if (lid) moverEstagio(lid, est.id); setLeadDragId(null); setDragOver(null); }}>
                    {col.map(lead => (
                      <LeadKanbanCard
                        key={lead.id}
                        lead={lead}
                        dragging={leadDragId === lead.id}
                        isMobile={isMobile}
                        draggable={!isMobile}
                        onDragStart={e => {
                          e.dataTransfer.setData("leadId", lead.id);
                          setLeadDragId(lead.id);
                        }}
                        onDragEnd={() => {
                          setLeadDragId(null);
                          setDragOver(null);
                        }}
                        onOpen={() =>
                          isMobile ? abrirDetalhe(lead) : router.push(`/crm/leads/${lead.id}`)
                        }
                        onEdit={() =>
                          isMobile ? abrirDetalhe(lead) : router.push(`/crm/leads/${lead.id}`)
                        }
                      />
                    ))}
                    {col.length === 0 && <p className="py-4 text-center text-xs text-[#8b949e]">vazio</p>}
                  </div>
                </div>
              );
            })}
          </div>

        ) : (

          /* LISTA */
          <div className="h-full overflow-y-auto">
            {isMobile ? (
              <ul className="space-y-2 p-3 pb-24">
                {filtrados.map(lead => {
                  const est = estagiosKanban.find((e) => e.id === estagioParaColunaKanban(lead.estagio));
                  return (
                    <li key={lead.id}>
                      <button
                        type="button"
                        onClick={() => abrirDetalhe(lead)}
                        className="flex w-full min-h-14 flex-col gap-2 rounded-xl border border-[#1d3a2c] bg-[#0f1d16] p-3 text-left"
                        style={{ borderLeftWidth: 3, borderLeftColor: borderColor(lead.atualizado_em) }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-[#e6edf3]">{lead.nome}</p>
                            {lead.telefone && <p className="text-xs text-[#8b949e]">{lead.telefone}</p>}
                          </div>
                          {est && (
                            <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: est.color + "25", color: est.color }}>
                              {est.label}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {lead.valor_estimado > 0 && <span className="text-xs font-bold text-[#22C55E]">{moeda(lead.valor_estimado)}</span>}
                          <span className="ml-auto text-xs text-[#8b949e]">{tempo(lead.atualizado_em)}</span>
                        </div>
                        {lead.telefone && (
                          <a
                            href={`https://wa.me/55${lead.telefone.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="flex min-h-11 w-full items-center justify-center rounded-lg bg-[#25D366] text-xs font-bold text-white"
                          >
                            WhatsApp
                          </a>
                        )}
                      </button>
                    </li>
                  );
                })}
                {filtrados.length === 0 && (
                  <p className="py-12 text-center text-sm text-[#8b949e]">Nenhum lead encontrado</p>
                )}
              </ul>
            ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#0f1d16] border-b border-[#1d3a2c]">
                <tr>
                  {["Nome", "Origem", "Estágio", "Valor", "Score", "Agente", "Atualizado", ""].map(h => (
                    <th key={h} className="text-left text-xs text-[#8b949e] font-bold uppercase tracking-wide px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map(lead => {
                  const est = estagiosKanban.find((e) => e.id === estagioParaColunaKanban(lead.estagio));
                  return (
                    <tr key={lead.id} onClick={() => router.push(`/crm/leads/${lead.id}`)}
                      className="border-b border-[#1d3a2c]/60 hover:bg-[#0f1d16]/60 cursor-pointer transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-[#e6edf3] font-bold">{lead.nome}</p>
                        {lead.telefone && <p className="text-[#8b949e] text-xs">{lead.telefone}</p>}
                      </td>
                      <td className="px-4 py-3">
                        {lead.origem ? (
                          <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: (ORIGENS_COLOR[lead.origem] || "#6B7280") + "25", color: ORIGENS_COLOR[lead.origem] || "#9CA3AF" }}>
                            {ORIGENS_LABEL[lead.origem] || lead.origem}
                          </span>
                        ) : <span className="text-[#484f58]">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {est && <span className="text-xs px-2 py-1 rounded-full font-bold" style={{ backgroundColor: est.color + "20", color: est.color }}>{est.label}</span>}
                      </td>
                      <td className="px-4 py-3">
                        {lead.valor_estimado > 0 ? <span className="text-[#22c55e] font-bold">{moeda(lead.valor_estimado)}</span> : <span className="text-[#484f58]">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-12 h-1.5 bg-[#1d3a2c] rounded-full overflow-hidden">
                            <div className="h-full bg-[#c9a24a] rounded-full" style={{ width: `${lead.score}%` }} />
                          </div>
                          <span className="text-[#8b949e] text-xs">{lead.score}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#8b949e] text-xs">{lead.agente_responsavel || "—"}</td>
                      <td className="px-4 py-3 text-[#8b949e] text-xs">{tempo(lead.atualizado_em)}</td>
                      <td className="px-4 py-3"><button type="button" onClick={(e) => { e.stopPropagation(); router.push(`/crm/leads/${lead.id}`); }} className="text-[#c9a24a] hover:text-[#e0b86a] text-xs">Ver →</button></td>
                    </tr>
                  );
                })}
                {filtrados.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-[#8b949e] text-sm">Nenhum lead encontrado</td></tr>
                )}
              </tbody>
            </table>
            )}
          </div>
        )}
      </div>

      {/* ─── LEAD DETAIL SLIDE-OVER ─── */}
      {detalhe && (
        <div className="fixed inset-0 z-50 flex">
          {!isMobile && (
            <div className="flex-1 bg-black/50" onClick={() => { setDetalhe(null); setConfirmandoPerda(false); }} />
          )}
          <div className={`flex h-full flex-col overflow-hidden border-[#1d3a2c] bg-[#0f1d16] shadow-2xl ${isMobile ? "w-full" : "w-[520px] border-l"}`}>

            {/* Header */}
            <div className="px-5 py-4 border-b border-[#1d3a2c] flex-shrink-0">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <h2 className="text-white font-black text-lg truncate">{detalhe.nome}</h2>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {detalhe.telefone && <span className="text-gray-500 text-xs">{detalhe.telefone}</span>}
                    {detalhe.email && <span className="text-gray-500 text-xs">{detalhe.email}</span>}
                    {detalhe.origem && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: (ORIGENS_COLOR[detalhe.origem] || "#6B7280") + "25", color: ORIGENS_COLOR[detalhe.origem] || "#9CA3AF" }}>
                        {ORIGENS_LABEL[detalhe.origem] || detalhe.origem}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => { setDetalhe(null); setConfirmandoPerda(false); }} className="text-gray-500 hover:text-white text-2xl">×</button>
              </div>

              {/* Stage selector */}
              <div className="flex gap-1 flex-wrap">
                {estagiosKanban.map(e => (
                  <button key={e.id} onClick={() => void moverEstagio(detalhe.id, e.id)}
                    className="text-xs px-2.5 py-1 rounded-full font-bold transition-all"
                    style={{
                      backgroundColor: estagioParaColunaKanban(detalhe.estagio) === e.id ? e.color : e.color + "18",
                      color: estagioParaColunaKanban(detalhe.estagio) === e.id ? "#fff" : e.color,
                      border: `1px solid ${estagioParaColunaKanban(detalhe.estagio) === e.id ? e.color : e.color + "40"}`,
                    }}>
                    {e.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex gap-2 px-5 py-3 border-b border-[#1d3a2c] flex-shrink-0 overflow-x-auto">
              {[
                { label: "Ligar", Icon: Phone, action: () => { if (detalhe?.telefone) window.open(`tel:${detalhe.telefone}`); } },
                { label: "Direcionar", Icon: Share2, action: () => setEncaminharLead(detalhe) },
                { label: "Negócio", Icon: Briefcase, action: () => void converterNegocio(detalhe) },
                { label: "Nota", Icon: StickyNote, action: () => setTabDetalhe("notas") },
                { label: "Perdido", Icon: XCircle, action: () => { setPerdaComoSpam(false); setConfirmandoPerda(true); } },
                { label: "Spam", Icon: Ban, action: () => { setPerdaComoSpam(true); setConfirmandoPerda(true); } },
              ].map(a => (
                <button key={a.label} onClick={a.action}
                  className="text-xs px-3 py-1.5 rounded-lg border border-[#1d3a2c] text-[#8b949e] hover:text-[#e6edf3] hover:border-[#484f58] flex items-center gap-1.5 flex-shrink-0 transition-colors">
                  <a.Icon size={13} strokeWidth={2} aria-hidden />
                  {a.label}
                </button>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[#1d3a2c] flex-shrink-0">
              {(["info", "timeline", "notas", "memorias"] as const).map(t => (
                <button key={t} onClick={() => setTabDetalhe(t)}
                  className={`flex-1 py-2.5 text-xs font-bold transition-colors ${tabDetalhe === t ? "text-[#c9a24a] border-b-2 border-[#c9a24a]" : "text-gray-500 hover:text-white"}`}>
                  {t === "info" ? "Info" : t === "timeline" ? "Timeline" : t === "notas" ? `Notas (${notas.length})` : "Memórias IA"}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">

              {tabDetalhe === "info" && (
                <div className="p-5 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Valor", value: detalhe.valor_estimado > 0 ? moeda(detalhe.valor_estimado) : "—" },
                      { label: "Score", value: `${detalhe.score}/100` },
                      { label: "Campanha", value: detalhe.campanha || "—" },
                      { label: "Agente", value: detalhe.agente_responsavel || "—" },
                      { label: "Responsável", value: detalhe.humano_responsavel || "—" },
                      { label: "Criado", value: new Date(detalhe.criado_em).toLocaleDateString("pt-BR") },
                    ].map(item => (
                      <div key={item.label} className="bg-[#0f1d16] rounded-xl p-3 border border-[#1d3a2c]">
                        <p className="text-gray-500 text-xs font-bold uppercase mb-1">{item.label}</p>
                        <p className="text-white text-sm font-bold truncate">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  {detalhe.proxima_acao && (
                    <div className="bg-[#1a1200] border border-[#4a3500] rounded-xl p-3">
                      <p className="text-[#c9a24a] text-xs font-bold uppercase mb-1">Próxima Ação</p>
                      <p className="text-white text-sm">{detalhe.proxima_acao}</p>
                    </div>
                  )}
                  {detalhe.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {detalhe.tags.map(tag => (
                        <span key={tag} className="text-xs bg-[#0f1d16] text-gray-400 px-2 py-1 rounded-full border border-[#1d3a2c]">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tabDetalhe === "timeline" && (
                <div className="p-5">
                  {atividades.length === 0
                    ? <p className="text-gray-600 text-sm text-center py-8">Nenhuma atividade registrada</p>
                    : (
                      <div>
                        {atividades.map((a, i) => (
                          <div key={a.id} className="flex gap-3 pb-4">
                            <div className="flex flex-col items-center flex-shrink-0">
                              <div className="w-8 h-8 rounded-full bg-[#0f1d16] border border-[#1d3a2c] flex items-center justify-center text-sm">
                                {ATIVIDADE_ICON[a.tipo] || "•"}
                              </div>
                              {i < atividades.length - 1 && <div className="w-px flex-1 bg-[#0f1d16] mt-1" />}
                            </div>
                            <div className="pt-1 flex-1 min-w-0">
                              <p className="text-white text-sm leading-snug">{a.descricao}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-gray-600 text-xs">{a.feito_por}</span>
                                <span className="text-gray-700">·</span>
                                <span className="text-gray-600 text-xs">{tempo(a.criado_em)} atrás</span>
                                {a.feito_por_tipo === "ia" && <span className="text-[#c9a24a] text-xs font-bold">IA</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              )}

              {tabDetalhe === "notas" && (
                <div className="p-5 space-y-3">
                  <div>
                    <textarea value={novaNota} onChange={e => setNovaNota(e.target.value)}
                      placeholder="Escreva uma nota..."
                      rows={3}
                      className="w-full bg-[#0f1d16] text-white text-sm rounded-xl p-3 border border-[#1d3a2c] focus:border-[#c9a24a] outline-none resize-none placeholder:text-gray-600" />
                    <button onClick={adicionarNota} disabled={!novaNota.trim()}
                      className="w-full mt-2 bg-[#c9a24a] hover:bg-[#e0b86a] disabled:opacity-40 text-white text-sm py-2 rounded-xl font-bold transition-colors">
                      + Adicionar Nota
                    </button>
                  </div>
                  {notas.length === 0
                    ? <p className="text-gray-600 text-sm text-center py-4">Nenhuma nota ainda</p>
                    : notas.map(n => (
                      <div key={n.id} className="bg-[#0f1d16] rounded-xl p-3 border border-[#1d3a2c]">
                        <p className="text-white text-sm leading-relaxed">{n.conteudo}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-gray-600 text-xs">{n.criado_por}</span>
                          <span className="text-gray-700">·</span>
                          <span className="text-gray-600 text-xs">{tempo(n.criado_em)} atrás</span>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {tabDetalhe === "memorias" && (
                <div className="p-5">
                  {memorias.length === 0
                    ? <p className="text-gray-600 text-sm text-center py-8">A IA ainda não registrou memórias sobre este lead</p>
                    : (
                      <div className="space-y-2">
                        {memorias.map(m => (
                          <div key={m.id} className="bg-[#0f1d16] rounded-xl p-3 border border-[#1d3a2c]">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[#c9a24a] text-xs font-bold uppercase">{m.chave}</span>
                              <span className="text-gray-600 text-xs">{Math.round(m.confianca * 100)}% confiança</span>
                            </div>
                            <p className="text-white text-sm">{m.valor}</p>
                            <p className="text-gray-600 text-xs mt-1">{tempo(m.criado_em)} atrás</p>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              )}
            </div>

            {/* Marcar perdido */}
            {confirmandoPerda && (
              <div className="flex-shrink-0 p-4 border-t border-red-900 bg-[#1a0000]">
                <p className="text-red-400 text-xs font-bold mb-2">
                  {perdaComoSpam ? "Motivo (spam/inválido):" : "Motivo da perda (obrigatório):"}
                </p>
                <select
                  value={motivoPerda}
                  onChange={(e) => setMotivoPerda(e.target.value)}
                  className="w-full bg-red-900 text-white text-sm rounded-lg px-3 py-2 border border-red-700 outline-none mb-2"
                >
                  <option value="">Selecione…</option>
                  {MOTIVOS_PERDA.map((m) => (
                    <option key={m} value={m}>
                      {MOTIVOS_PERDA_LABEL[m] ?? m}
                    </option>
                  ))}
                </select>
                {motivoPerda === "outro" && (
                  <input
                    value={motivoPerdaOutro}
                    onChange={(e) => setMotivoPerdaOutro(e.target.value)}
                    placeholder="Descreva o motivo…"
                    className="w-full bg-red-900 text-white text-sm rounded-lg px-3 py-2 border border-red-700 outline-none placeholder:text-red-400 mb-2"
                  />
                )}
                <div className="flex gap-2">
                  <button onClick={() => { setConfirmandoPerda(false); setPerdaComoSpam(false); }} className="flex-1 bg-[#0f1d16] text-gray-400 text-sm py-2 rounded-lg font-bold hover:text-white transition-colors">Cancelar</button>
                  <button
                    onClick={() => void marcarPerdido()}
                    disabled={!motivoPerda.trim() || (motivoPerda === "outro" && !motivoPerdaOutro.trim())}
                    className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm py-2 rounded-lg font-bold transition-colors"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {leadRapidoOpen && (
        <LeadRapidoSideover
          open={leadRapidoOpen}
          onClose={() => setLeadRapidoOpen(false)}
          onSaved={(lead) => {
            setSucessoLead(`Lead criado.`);
            void carregar();
          }}
        />
      )}

      {encaminharLead && (
        <DirecionarLeadDrawer
          open
          leadId={encaminharLead.id}
          leadNome={encaminharLead.nome}
          onClose={() => setEncaminharLead(null)}
          onQualificar={() => moverEstagio(encaminharLead.id, "qualificado")}
          onDirecionado={() => {
            void moverEstagio(encaminharLead.id, "encaminhado");
            void carregar();
          }}
        />
      )}

      {acaoErro ? (
        <div
          role="alert"
          className="fixed left-1/2 top-4 z-[150] max-w-[90vw] -translate-x-1/2 rounded-xl border border-[#f8514966] bg-[#1a0a0a] px-4 py-2.5 text-sm text-[#ff7b72] shadow-xl"
        >
          {acaoErro}
        </div>
      ) : null}

      <PipelineConfigSideover
        open={pipelineConfigOpen}
        onClose={() => setPipelineConfigOpen(false)}
        tipo="lead"
        pipelineId={pipelineId}
        onSelectPipeline={(id) => setPipelineId(id)}
        onUpdated={() => {
          void carregarPipeline();
        }}
      />
    </div>
  );
}
