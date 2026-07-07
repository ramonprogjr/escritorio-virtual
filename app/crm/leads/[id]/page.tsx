"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { estagioParaColunaKanban, legacyToFunil } from "@/lib/crm/estagio-map";
import { avaliarQualificacao } from "@/lib/crm/lead-rules";
import { patchLeadCrm } from "@/lib/crm/patch-lead-client";
import { FUNIL_LEAD_ETAPAS, MOTIVOS_PERDA, MOTIVOS_PERDA_LABEL } from "@/lib/crm/pipelines";
import { CrmStickyTabs } from "@/components/crm/CrmStickyTabs";
import { LeadPropostasPanel } from "@/components/crm/LeadPropostasPanel";
import { VincularPessoaLead } from "@/components/crm/VincularPessoaLead";
import { DistribuirLeadPanel } from "@/components/crm/DistribuirLeadPanel";
import { useCrmTenant } from "@/components/crm/CrmTenantContext";
import { isCrmGestorRole } from "@/lib/crm/crm-permissoes";
import { toast } from "@/components/crm/toast";
import {
  emailExibicao,
  type PessoaMini,
  ultimaMensagemExibicao,
  type UltimaFilaMini,
} from "@/lib/crm/enrich-lead-crm";
import {
  Brain,
  Briefcase,
  ChevronLeft,
  ClipboardList,
  FileText,
  History,
  IdCard,
  MessageSquare,
  Pencil,
  Sparkles,
  User,
  X,
} from "lucide-react";

const ESTAGIO_COR: Record<string, string> = Object.fromEntries(
  FUNIL_LEAD_ETAPAS.map((e) => [e.slug, e.cor])
);

/** Fundo mais escuro (timelapse / OLED-ish), alinhado ao pedido */
const BG_DEEP = "#05080e";
const BG_PANEL = "#0a1018";
const BORDER_SUBTLE = "rgba(48, 54, 61, 0.38)";
const TIMELINE_TRACK = "rgba(201, 162, 74, 0.35)";

function tempoRelativo(data: string) {
  const diff = (Date.now() - new Date(data).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.round(diff / 60)}min`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h`;
  return new Date(data).toLocaleDateString("pt-BR");
}

function formatarDataHora(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function confiancaPercentual(mem: Record<string, unknown>): string {
  const c = (mem.confianca ?? mem.relevancia) as number | undefined;
  if (c == null || Number.isNaN(Number(c))) return "—";
  const n = Number(c);
  const p = n > 1 ? n : n * 100;
  return `${Math.round(p)}%`;
}

type ChipMemoria = {
  key: string;
  titulo: string;
  corpo: string;
  rodape: string;
};

/**
 * Suporta:
 * - Legado (código atual / webhook): chave, valor, confianca, criado_por
 * - Schema “documento” com JSON: resumo_ia, dados_coletados, preferencias_detectadas, arrays, nivel_engajamento, etc.
 */
function chipsFromMemoriaRow(mem: Record<string, unknown>): ChipMemoria[] {
  const id = String(mem.id ?? Math.random());
  const ts =
    formatarDataHora(
      (mem.atualizado_em ?? mem.criado_em) as string | undefined
    ) || "—";
  const criadoPor = mem.criado_por ? String(mem.criado_por) : "";

  const out: ChipMemoria[] = [];

  if (mem.chave != null && (mem.valor != null || mem.conteudo != null)) {
    out.push({
      key: `${id}-kv`,
      titulo: String(mem.chave),
      corpo: String(mem.valor ?? mem.conteudo ?? ""),
      rodape: [confiancaPercentual(mem), criadoPor].filter(Boolean).join(" · ") || ts,
    });
    return out;
  }

  if (mem.resumo_ia != null && String(mem.resumo_ia).trim()) {
    out.push({
      key: `${id}-resumo`,
      titulo: "Resumo IA",
      corpo: String(mem.resumo_ia).trim(),
      rodape: [ts, criadoPor].filter(Boolean).join(" · "),
    });
  }

  const dump = (label: string, obj: unknown) => {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return;
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (v == null || v === "") continue;
      out.push({
        key: `${id}-${label}-${k}`,
        titulo: `${label}: ${k}`,
        corpo: typeof v === "object" ? JSON.stringify(v, null, 0) : String(v),
        rodape: ts,
      });
    }
  };

  dump("Dado", mem.dados_coletados);
  dump("Preferência", mem.preferencias_detectadas);

  const arr = (label: string, a: unknown) => {
    if (!Array.isArray(a) || a.length === 0) return;
    out.push({
      key: `${id}-arr-${label}`,
      titulo: label,
      corpo: a.map((x) => `• ${String(x)}`).join("\n"),
      rodape: ts,
    });
  };

  arr("Objeções", mem.objecoes_levantadas as unknown);
  arr("Interesses", mem.interesses_confirmados as unknown);
  arr("Abordagens eficazes", mem.abordagens_eficazes as unknown);
  arr("Abordagens ineficazes", mem.abordagens_ineficazes as unknown);

  if (mem.melhor_horario_resposta != null && String(mem.melhor_horario_resposta).trim()) {
    out.push({
      key: `${id}-horario`,
      titulo: "Melhor horário",
      corpo: String(mem.melhor_horario_resposta),
      rodape: ts,
    });
  }
  if (mem.humor_predominante != null && String(mem.humor_predominante).trim()) {
    out.push({
      key: `${id}-humor`,
      titulo: "Humor predominante",
      corpo: String(mem.humor_predominante),
      rodape: ts,
    });
  }
  if (mem.nivel_engajamento != null) {
    out.push({
      key: `${id}-eng`,
      titulo: "Engajamento",
      corpo: `${mem.nivel_engajamento}/10`,
      rodape: ts,
    });
  }

  if (out.length === 0 && mem.id) {
    out.push({
      key: `${id}-raw`,
      titulo: "Registo (estrutura mista)",
      corpo:
        "Existe uma linha em hub_memorias_lead sem campos reconhecidos pelo painel. Verifique se o BD usa o mesmo modelo que o código (chave/valor vs. JSON) e se lead_id referencia hub_leads_crm.",
      rodape: ts,
    });
  }

  return out;
}

/** Colunas da view PostgREST — retiradas antes de guardar o lead (mutações usam hub_leads_crm). */
const VW_LEAD_CRM_EXTRA = [
  "pessoa_codigo",
  "pessoa_nome_completo",
  "email_exibicao",
  "pessoa_cidade",
  "pessoa_estado",
  "ultima_mensagem_fila",
  "ultima_mensagem_fila_em",
] as const;

function leadRecordFromVwRow(row: Record<string, unknown>): Record<string, unknown> {
  const o = { ...row };
  for (const k of VW_LEAD_CRM_EXTRA) delete o[k];
  return o;
}

export default function LeadFichaPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { role } = useCrmTenant();
  const ehGestor = isCrmGestorRole(role);

  const [lead, setLead] = useState<Record<string, unknown> | null>(null);
  const [pessoaHub, setPessoaHub] = useState<PessoaMini | null>(null);
  const [ultimaFila, setUltimaFila] = useState<UltimaFilaMini | null>(null);
  const [atividades, setAtividades] = useState<Record<string, unknown>[]>([]);
  const [memorias, setMemorias] = useState<Record<string, unknown>[]>([]);
  const [aba, setAba] = useState<"atividades" | "propostas" | "dados">("atividades");
  const [mostrarSistema, setMostrarSistema] = useState(false);
  const [mostrarMemorias, setMostrarMemorias] = useState(false);
  const [memoriasErro, setMemoriasErro] = useState<string | null>(null);
  const [perdaAberta, setPerdaAberta] = useState(false);
  const [motivoPerda, setMotivoPerda] = useState("");
  const [novaNota, setNovaNota] = useState("");
  const [salvandoNota, setSalvandoNota] = useState(false);

  const carregar = useCallback(async () => {
    if (!id) return;
    setMemoriasErro(null);

    const [vwRes, a, memRes] = await Promise.all([
      supabase.from("vw_hub_leads_crm_enriquecido").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("hub_atividades")
        .select("*")
        .eq("lead_id", id)
        .order("criado_em", { ascending: false })
        .limit(80),
      supabase.from("hub_memorias_lead").select("*").eq("lead_id", id),
    ]);

    let lData: Record<string, unknown> | null = null;

    if (!vwRes.error && vwRes.data) {
      const row = vwRes.data as Record<string, unknown>;
      lData = leadRecordFromVwRow(row);
      setLead(lData);

      const pid = row.pessoa_id as string | null | undefined;
      const hasPessoa =
        pid &&
        (row.pessoa_codigo != null ||
          row.pessoa_nome_completo != null ||
          row.pessoa_cidade != null ||
          row.pessoa_estado != null);
      if (hasPessoa) {
        const emailLead = (row.email && String(row.email).trim()) || "";
        setPessoaHub({
          codigo: row.pessoa_codigo != null ? String(row.pessoa_codigo) : null,
          nome: row.pessoa_nome_completo != null ? String(row.pessoa_nome_completo) : null,
          email:
            emailLead || row.email_exibicao == null
              ? null
              : String(row.email_exibicao),
          cidade: row.pessoa_cidade != null ? String(row.pessoa_cidade) : null,
          estado: row.pessoa_estado != null ? String(row.pessoa_estado) : null,
        });
      } else if (pid) {
        const { data: pes } = await supabase
          .from("hub_pessoas")
          .select("codigo, nome, email, cidade, estado")
          .eq("id", pid)
          .maybeSingle();
        setPessoaHub(
          pes
            ? {
                codigo: pes.codigo != null ? String(pes.codigo) : null,
                nome: pes.nome != null ? String(pes.nome) : null,
                email: pes.email != null ? String(pes.email) : null,
                cidade: pes.cidade != null ? String(pes.cidade) : null,
                estado: pes.estado != null ? String(pes.estado) : null,
              }
            : null
        );
      } else {
        setPessoaHub(null);
      }

      if (row.ultima_mensagem_fila != null || row.ultima_mensagem_fila_em) {
        setUltimaFila({
          conteudo:
            row.ultima_mensagem_fila != null ? String(row.ultima_mensagem_fila) : null,
          criado_em:
            row.ultima_mensagem_fila_em != null ? String(row.ultima_mensagem_fila_em) : null,
        });
      } else {
        setUltimaFila(null);
      }
    } else {
      const [l, filaRes] = await Promise.all([
        supabase.from("hub_leads_crm").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("hub_fila_mensagens")
          .select("conteudo, criado_em")
          .eq("lead_id", id)
          .order("criado_em", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (filaRes.data?.conteudo != null || filaRes.data?.criado_em) {
        setUltimaFila({
          conteudo: filaRes.data.conteudo != null ? String(filaRes.data.conteudo) : null,
          criado_em: filaRes.data.criado_em != null ? String(filaRes.data.criado_em) : null,
        });
      } else {
        setUltimaFila(null);
      }

      if (l.data) {
        lData = l.data as Record<string, unknown>;
        setLead(lData);
        const pid = (l.data as { pessoa_id?: string | null }).pessoa_id;
        if (pid) {
          const { data: pes } = await supabase
            .from("hub_pessoas")
            .select("codigo, nome, email, cidade, estado")
            .eq("id", pid)
            .maybeSingle();
          setPessoaHub(
            pes
              ? {
                  codigo: pes.codigo != null ? String(pes.codigo) : null,
                  nome: pes.nome != null ? String(pes.nome) : null,
                  email: pes.email != null ? String(pes.email) : null,
                  cidade: pes.cidade != null ? String(pes.cidade) : null,
                  estado: pes.estado != null ? String(pes.estado) : null,
                }
              : null
          );
        } else {
          setPessoaHub(null);
        }
      } else {
        setLead(null);
        setPessoaHub(null);
        setUltimaFila(null);
      }
    }

    if (a.data) setAtividades(a.data);

    let rows = memRes.data ?? [];
    let memErr = memRes.error;

    if (!memErr && rows.length === 0 && lData && (lData as { pessoa_id?: string }).pessoa_id) {
      const pid = (lData as { pessoa_id: string }).pessoa_id;
      const { data: hl } = await supabase
        .from("hub_leads")
        .select("id")
        .eq("pessoa_id", pid)
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (hl?.id) {
        const m2 = await supabase.from("hub_memorias_lead").select("*").eq("lead_id", hl.id);
        if (m2.error) memErr = m2.error;
        else rows = m2.data ?? [];
      }
    }

    if (memErr) {
      setMemoriasErro(memErr.message);
      setMemorias([]);
    } else {
      rows.sort((x, y) => {
        const cx = Number(x.confianca ?? 0);
        const cy = Number(y.confianca ?? 0);
        if (cx !== cy) return cy - cx;
        const tx = new Date(String(x.atualizado_em ?? x.criado_em ?? 0)).getTime();
        const ty = new Date(String(y.atualizado_em ?? y.criado_em ?? 0)).getTime();
        return ty - tx;
      });
      setMemorias(rows);
    }
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function registrarNota() {
    const txt = novaNota.trim();
    if (!txt || salvandoNota) return;
    setSalvandoNota(true);
    try {
      const res = await fetch(`/api/crm/leads/${encodeURIComponent(id)}/nota`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({ descricao: txt }),
      });
      if (res.ok) {
        setNovaNota("");
        await carregar();
      }
    } finally {
      setSalvandoNota(false);
    }
  }

  const chipsMemoria = useMemo(() => memorias.flatMap(chipsFromMemoriaRow), [memorias]);

  async function criarNegocio() {
    // Fronteira (decisão do dono): converter EXIGE prontidão (interesse + valor). Não é wall hard —
    // avisa e deixa seguir com ciência (os campos são editáveis na aba Dados). AUDITORIA-CICLO-LEAD-v1.md.
    const p = avaliarQualificacao({
      interesse_principal: lead?.interesse_principal as string | null,
      valor_estimado: lead?.valor_estimado as number | null,
    });
    if (!p.pronto) {
      const ok = window.confirm(
        `Este lead ainda não está pronto para virar negócio (${p.motivo}). Você pode preencher interesse e valor na aba Dados. Converter mesmo assim?`
      );
      if (!ok) return;
    }
    const res = await fetch(`/api/crm/leads/${id}/converter-negocio`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({}),
    });
    const json = (await res.json()) as { data?: { id: string }; error?: string };
    if (!res.ok) {
      alert(json.error || "Não foi possível criar o negócio.");
      return;
    }
    if (json.data?.id) router.push(`/crm/negocios/${json.data.id}`);
  }

  async function moverEstagio(estagioNovo: string, extra?: Record<string, unknown>): Promise<boolean> {
    const res = await patchLeadCrm(id, {
      estagio: estagioNovo,
      _estagio_anterior: lead?.estagio as string,
      ...extra,
    });
    if (!res.ok) {
      alert(res.error);
      return false;
    }
    await carregar();
    return true;
  }

  // Edição inline de um campo do lead (aba Dados) — reusa o PATCH allowlist já pronto.
  async function salvarCampo(field: string, valor: string): Promise<boolean> {
    const payload: Record<string, unknown> =
      field === "valor_estimado"
        ? { valor_estimado: valor.trim() === "" ? 0 : Number(valor.replace(",", ".")) || 0 }
        : { [field]: valor.trim() };
    const res = await patchLeadCrm(id, payload);
    if (!res.ok) {
      toast.error(res.error || "Não foi possível salvar.");
      return false;
    }
    await carregar();
    toast.success("Campo atualizado.");
    return true;
  }

  async function confirmarPerda() {
    if (!motivoPerda) return;
    setPerdaAberta(false);
    await moverEstagio("perdido", { motivo_perda: motivoPerda });
  }

  if (!lead) {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-sm"
        style={{ backgroundColor: BG_DEEP, color: "#8b949e" }}
      >
        Carregando ficha…
      </div>
    );
  }

  const estagio = estagioParaColunaKanban(lead.estagio as string); // coluna do kanban (agrupamento)
  // Vocabulário do FUNIL visível (barra + badge): o dono só lê as 8 etapas do ciclo de vida.
  // A barra e o badge falam ESTE vocabulário, não o slug cru de coluna de vendas (que fazia o
  // chip não acender e a cor cair no fallback). Ver docs/AUDITORIA-CICLO-LEAD-v1.md.
  const estagioFunil = legacyToFunil(lead.estagio as string);
  const etapaFunil = FUNIL_LEAD_ETAPAS.find((e) => e.slug === estagioFunil);
  const estagioLabel = etapaFunil?.label ?? estagio;
  const corEstagio = etapaFunil?.cor || ESTAGIO_COR[estagio] || "#888";

  // Corte comentários × logs de sistema (auditoria do lead): comentário (nota) e evento de IA ficam
  // sempre visíveis (transparência — "o sistema mostra o que fez sozinho"); logs operacionais
  // (status_change/proposta/conversão) só para gestor, atrás de um toggle. AUDITORIA-CICLO-LEAD-v1.md.
  const naturezaAtividade = (at: Record<string, unknown>): "nota" | "ia" | "log" => {
    if ((at.tipo as string) === "nota") return "nota";
    if ((at.feito_por_tipo as string) === "ia") return "ia";
    return "log";
  };
  const conversa = atividades.filter((a) => naturezaAtividade(a) !== "log");
  const logsSistema = atividades.filter((a) => naturezaAtividade(a) === "log");
  const atividadesVisiveis = ehGestor && mostrarSistema ? atividades : conversa;

  // Prontidão (sinal derivado, não etapa): pronto = interesse + valor (decisão do dono). A IA já
  // sugere sozinha na origem; aqui a ficha MOSTRA o estado + gateia converter/direcionar.
  const prontidao = avaliarQualificacao({
    interesse_principal: lead.interesse_principal as string | null,
    valor_estimado: lead.valor_estimado as number | null,
  });
  const meta = (lead.metadata as Record<string, unknown>) || {};
  const mercadoMeta =
    (meta.mercado as string) || (meta.primeira_mensagem != null ? "ver metadata" : null);
  const parceiroId = typeof meta.parceiro_id === "string" ? meta.parceiro_id : null;
  const parceiroNome =
    typeof meta.parceiro_nome === "string"
      ? meta.parceiro_nome
      : typeof meta.parceiro_codigo === "string"
        ? meta.parceiro_codigo
        : null;
  const parceiroPapel =
    meta.parceiro_papel === "corretor" || meta.parceiro_papel === "arquiteto"
      ? meta.parceiro_papel
      : "parceiro";

  const camposDados: { label: string; value: string; field?: string; editType?: "text" | "number" | "email"; rawValue?: string }[] = [
    { label: "Score", value: `${lead.score ?? 0}/100` },
    { label: "Origem", value: (lead.origem as string) || "—", field: "origem", editType: "text", rawValue: (lead.origem as string) || "" },
    {
      label: "E-mail",
      value: emailExibicao(lead.email as string | null | undefined, pessoaHub ?? undefined),
      field: "email",
      editType: "email",
      rawValue: (lead.email as string) || "",
    },
    { label: "Campanha", value: (lead.campanha as string) || "—" },
    { label: "Mercado (metadata)", value: mercadoMeta || "—" },
    { label: "Interesse", value: (lead.interesse_principal as string) || "—", field: "interesse_principal", editType: "text", rawValue: (lead.interesse_principal as string) || "" },
    {
      label: "Cidade / UF",
      value:
        [pessoaHub?.cidade, pessoaHub?.estado].filter(Boolean).join(" / ") || "—",
    },
    { label: "Agente", value: (lead.agente_responsavel as string) || "—", field: "agente_responsavel", editType: "text", rawValue: (lead.agente_responsavel as string) || "" },
    { label: "Responsável", value: (lead.humano_responsavel as string) || "IA", field: "humano_responsavel", editType: "text", rawValue: (lead.humano_responsavel as string) || "" },
    {
      label: "Última mensagem",
      value: ultimaMensagemExibicao(
        lead.ultima_mensagem as string | null | undefined,
        ultimaFila,
        120
      ),
    },
    {
      label: "Último contato",
      value: lead.ultimo_contato
        ? formatarDataHora(lead.ultimo_contato as string)
        : ultimaFila?.criado_em
          ? formatarDataHora(ultimaFila.criado_em)
          : "—",
    },
    { label: "Toques", value: String(atividades.length) },
    {
      label: "1º contato",
      value: (() => {
        if (atividades.length === 0) return "Sem contato";
        const primeira = atividades[atividades.length - 1];
        const ini = lead.criado_em ? new Date(lead.criado_em as string).getTime() : null;
        const fim = primeira?.criado_em ? new Date(primeira.criado_em as string).getTime() : null;
        if (!ini || !fim || fim < ini) return formatarDataHora((primeira?.criado_em as string) ?? null);
        const horas = Math.round((fim - ini) / 3600000);
        return horas < 1
          ? "< 1h após entrada"
          : horas < 48
            ? `${horas}h após entrada`
            : `${Math.round(horas / 24)}d após entrada`;
      })(),
    },
    { label: "Próxima ação", value: (lead.proxima_acao as string) || "—", field: "proxima_acao", editType: "text", rawValue: (lead.proxima_acao as string) || "" },
    {
      label: "Valor",
      value:
        (lead.valor_estimado as number) > 0
          ? `R$ ${((lead.valor_estimado as number) / 1000).toFixed(0)}k`
          : "—",
      field: "valor_estimado",
      editType: "number",
      rawValue: lead.valor_estimado ? String(lead.valor_estimado) : "",
    },
    {
      label: "Criado em",
      value: new Date(lead.criado_em as string).toLocaleDateString("pt-BR"),
    },
  ];

  const CARD_INNER = "rgba(8, 12, 20, 0.65)";

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: BG_DEEP }}>
      <header
        className="flex flex-shrink-0 items-center justify-between gap-3 border-b px-4 py-3 md:px-5"
        style={{ borderColor: BORDER_SUBTLE, backgroundColor: BG_PANEL }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="hidden h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border text-gray-400 transition-colors hover:bg-white/[0.06] hover:text-white md:flex"
            style={{ borderColor: BORDER_SUBTLE }}
            aria-label="Voltar"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2} />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-base font-bold tracking-tight text-white md:text-lg">
                {lead.nome as string}
              </h1>
              <span
                className="rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                style={{
                  backgroundColor: `${corEstagio}18`,
                  color: corEstagio,
                  border: `1px solid ${corEstagio}44`,
                }}
              >
                {estagioLabel}
              </span>
              {prontidao.pronto ? (
                <span
                  className="rounded-md px-2 py-0.5 text-[11px] font-semibold"
                  style={{ backgroundColor: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.35)" }}
                  title={prontidao.motivo}
                >
                  ✓ Pronto para direcionar
                </span>
              ) : (
                <span
                  className="rounded-md px-2 py-0.5 text-[11px] font-medium"
                  style={{ backgroundColor: "rgba(139,148,158,0.10)", color: "#8b949e", border: "1px solid rgba(139,148,158,0.25)" }}
                  title={prontidao.motivo}
                >
                  Falta {prontidao.faltam.join(" e ")}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs" style={{ color: "#7d8a99" }}>
              {lead.telefone as string} · {lead.origem as string}
              {(lead.valor_estimado as number) > 0 &&
                ` · R$ ${((lead.valor_estimado as number) / 1000).toFixed(0)}k`}
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 gap-2">
          <DistribuirLeadPanel
            leadId={id}
            leadNome={lead.nome as string}
            onDone={() => void carregar()}
            onQualificar={() => moverEstagio("qualificando")}
          />
          <button
            type="button"
            onClick={() => void criarNegocio()}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold transition-colors md:text-sm"
            style={{ borderColor: BORDER_SUBTLE, color: "#c9a24a", background: "#003b2622" }}
          >
            <Briefcase className="h-4 w-4" strokeWidth={2} />
            Converter em negócio
          </button>
          <button
            type="button"
            onClick={() => router.push(`/crm/atendimento?lead=${id}`)}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors md:text-sm"
            style={{
              background: "linear-gradient(180deg, #c45c26 0%, #9a471d 100%)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
            }}
          >
            <MessageSquare className="h-4 w-4 opacity-90" strokeWidth={2} />
            Central de atendimento
          </button>
        </div>
      </header>

      {perdaAberta && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPerdaAberta(false)}
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.62)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, borderRadius: 14, border: "1px solid #1d3a2c", background: "#0a140f", padding: 20 }}>
            <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#e6edf3" }}>Marcar lead como perdido</p>
            <p style={{ margin: "0 0 14px", fontSize: 12, color: "#8b949e" }}>Escolha o motivo — alimenta os KPIs de perda.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
              {MOTIVOS_PERDA.map((m) => {
                const sel = motivoPerda === m;
                return (
                  <button key={m} type="button" onClick={() => setMotivoPerda(m)}
                    style={{ padding: "6px 11px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: sel ? "1px solid #c9a24a" : "1px solid #1d3a2c", background: sel ? "#c9a24a22" : "transparent", color: sel ? "#c9a24a" : "#8b949e" }}>
                    {MOTIVOS_PERDA_LABEL[m] ?? m}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" onClick={() => setPerdaAberta(false)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #1d3a2c", background: "transparent", color: "#8b949e", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Cancelar
              </button>
              <button type="button" onClick={() => void confirmarPerda()} disabled={!motivoPerda} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: motivoPerda ? "#da3633" : "#1d3a2c", color: "#fff", fontSize: 13, fontWeight: 700, cursor: motivoPerda ? "pointer" : "not-allowed" }}>
                Confirmar perda
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className="flex flex-shrink-0 gap-1 overflow-x-auto border-b px-3 py-2 md:px-4"
        style={{ borderColor: BORDER_SUBTLE, backgroundColor: "rgba(5, 8, 14, 0.92)" }}
      >
        {FUNIL_LEAD_ETAPAS.map((e) => (
          <button
            key={e.slug}
            type="button"
            onClick={() => {
              if (e.slug === "perdido") { setMotivoPerda(""); setPerdaAberta(true); }
              else void moverEstagio(e.slug);
            }}
            className={`whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors md:text-xs ${
              estagioFunil === e.slug ? "font-semibold" : "text-gray-500 hover:bg-white/[0.05] hover:text-gray-300"
            }`}
            style={
              estagioFunil === e.slug
                ? {
                    backgroundColor: `${e.cor}22`,
                    color: e.cor,
                    border: `1px solid ${e.cor}55`,
                  }
                : { border: `1px solid transparent` }
            }
          >
            {e.label}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <CrmStickyTabs
          activeId={aba}
          onChange={(tabId) => setAba(tabId as typeof aba)}
          equalColumns
          tabs={[
            { id: "atividades", label: `Conversa (${conversa.length})`, icon: MessageSquare },
            { id: "propostas", label: "Propostas", icon: FileText },
            { id: "dados", label: "Dados", icon: IdCard },
          ]}
          style={{
            background: BG_PANEL,
            borderBottom: `1px solid ${BORDER_SUBTLE}`,
            boxShadow: "none",
          }}
        />

          {aba === "atividades" && (
            <div
              className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6"
              style={{ backgroundColor: BG_DEEP }}
            >
              <div className="mx-auto mb-5 flex max-w-2xl gap-2">
                <input
                  value={novaNota}
                  onChange={(e) => setNovaNota(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void registrarNota();
                  }}
                  placeholder="Registrar uma nota…"
                  className="min-w-0 flex-1 rounded-lg border px-3 py-2.5 text-sm outline-none"
                  style={{ borderColor: BORDER_SUBTLE, backgroundColor: "rgba(15,22,32,0.95)", color: "#e6edf3" }}
                />
                <button
                  type="button"
                  disabled={salvandoNota || !novaNota.trim()}
                  onClick={() => void registrarNota()}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 8,
                    border: "none",
                    background: "#c9a24a",
                    color: "#003b26",
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: salvandoNota || !novaNota.trim() ? "default" : "pointer",
                    opacity: salvandoNota || !novaNota.trim() ? 0.6 : 1,
                  }}
                >
                  {salvandoNota ? "…" : "Adicionar"}
                </button>
              </div>
              {chipsMemoria.length > 0 || (ehGestor && logsSistema.length > 0) ? (
                <div className="mx-auto mb-3 flex max-w-2xl flex-wrap items-center justify-between gap-2">
                  {chipsMemoria.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setMostrarMemorias((v) => !v)}
                      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors hover:brightness-125"
                      style={{ borderColor: "rgba(201,162,74,0.35)", color: "#c9a24a", backgroundColor: "rgba(201,162,74,0.08)" }}
                    >
                      <Brain className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                      {mostrarMemorias ? "Ocultar memórias da IA" : `Memórias da IA (${chipsMemoria.length})`}
                    </button>
                  ) : (
                    <span />
                  )}
                  {ehGestor && logsSistema.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setMostrarSistema((v) => !v)}
                      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors hover:text-gray-200"
                      style={{ borderColor: BORDER_SUBTLE, color: "#8b949e", backgroundColor: "rgba(15,22,32,0.6)" }}
                    >
                      <History className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                      {mostrarSistema ? "Ocultar histórico do sistema" : `Histórico do sistema (${logsSistema.length})`}
                    </button>
                  ) : null}
                </div>
              ) : null}
              {mostrarMemorias && chipsMemoria.length > 0 ? (
                <div className="mx-auto mb-4 flex max-w-2xl flex-col gap-2">
                  {memoriasErro ? (
                    <div className="rounded-lg border border-amber-900/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-100">
                      Erro ao ler memórias: {memoriasErro}
                    </div>
                  ) : null}
                  {chipsMemoria.map((c) => (
                    <div
                      key={c.key}
                      className="rounded-lg border px-3 py-2.5"
                      style={{ borderColor: BORDER_SUBTLE, backgroundColor: "rgba(10, 16, 24, 0.88)" }}
                    >
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#c9a24a]">
                          {c.titulo}
                        </span>
                        <span className="text-[10px] text-[#5c6570]">{c.rodape}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-200">{c.corpo}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              {atividadesVisiveis.length === 0 ? (
                <p className="pt-12 text-center text-xs" style={{ color: "#5c6570" }}>
                  Nenhuma conversa registrada ainda — use o campo acima.
                </p>
              ) : (
                <div className="relative mx-auto max-w-2xl">
                  <div
                    className="absolute bottom-0 left-[15px] top-2 w-px md:left-[17px]"
                    style={{ background: `linear-gradient(180deg, ${TIMELINE_TRACK}, transparent)` }}
                    aria-hidden
                  />
                  <ul className="relative flex flex-col gap-0">
                    {atividadesVisiveis.map((at, idx) => {
                      const natureza = naturezaAtividade(at);
                      const isIa = natureza === "ia";
                      const isLog = natureza === "log";
                      const dataAbs = formatarDataHora(at.criado_em as string);
                      return (
                        <li key={at.id as string} className="relative flex gap-4 pb-8 pl-10 md:gap-5 md:pl-11">
                          <div
                            className="absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full border md:left-0.5 md:h-9 md:w-9"
                            style={{
                              borderColor: isIa ? "rgba(201,162,74,0.45)" : BORDER_SUBTLE,
                              backgroundColor: isIa ? "rgba(201,162,74,0.12)" : "rgba(15,22,32,0.95)",
                              boxShadow: "0 0 0 4px rgba(5,8,14,0.9)",
                            }}
                          >
                            {isIa ? (
                              <Sparkles className="h-4 w-4 text-[#d6b976]" strokeWidth={2} />
                            ) : isLog ? (
                              <History className="h-4 w-4 text-gray-500" strokeWidth={2} />
                            ) : (
                              <User className="h-4 w-4 text-gray-400" strokeWidth={2} />
                            )}
                          </div>
                          <div
                            className="min-w-0 flex-1 rounded-lg border px-3 py-2.5 md:px-4"
                            style={{
                              borderColor: BORDER_SUBTLE,
                              backgroundColor: idx === 0 ? "rgba(16,24,36,0.85)" : "rgba(10,14,22,0.72)",
                            }}
                          >
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <span className="flex items-center gap-1.5">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#8b949e]">
                                  {String(at.tipo || "evento").replace(/_/g, " ")}
                                </span>
                                {isLog ? (
                                  <span className="rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wide" style={{ color: "#6b7480", backgroundColor: "rgba(107,116,128,0.14)" }}>
                                    sistema
                                  </span>
                                ) : isIa ? (
                                  <span className="rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wide" style={{ color: "#c9a24a", backgroundColor: "rgba(201,162,74,0.14)" }}>
                                    IA
                                  </span>
                                ) : null}
                              </span>
                              <time
                                className="text-[10px] tabular-nums text-[#5c6570]"
                                dateTime={at.criado_em as string}
                              >
                                {dataAbs}
                              </time>
                            </div>
                            <p className="mt-1.5 text-sm leading-relaxed text-gray-200">
                              {at.descricao as string}
                            </p>
                            <p className="mt-2 text-[11px]" style={{ color: "#5c6570" }}>
                              <span className="text-[#7d8a99]">{(at.feito_por as string) || "—"}</span>
                              {" · "}
                              {tempoRelativo(at.criado_em as string)}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}

          {aba === "propostas" && (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6" style={{ backgroundColor: BG_DEEP }}>
              <div className="mx-auto max-w-lg">
                <LeadPropostasPanel leadId={id} />
              </div>
            </div>
          )}

          {aba === "dados" && (
            <div
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              style={{ backgroundColor: BG_DEEP }}
            >
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
                <article
                  className="mx-auto max-w-5xl rounded-2xl border p-4 shadow-[0_12px_40px_rgba(0,0,0,0.35)] md:p-6"
                  style={{
                    borderColor: BORDER_SUBTLE,
                    background:
                      "linear-gradient(165deg, rgba(18, 26, 38, 0.95) 0%, rgba(8, 12, 18, 0.98) 100%)",
                  }}
                >
                  <div
                    className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-dashed pb-4"
                    style={{ borderColor: BORDER_SUBTLE }}
                  >
                    <div className="min-w-0 flex-1">
                      <h2 className="text-sm font-semibold text-white" title={`ID técnico (copiar): ${id}`}>
                        Registo CRM
                      </h2>
                      <p className="mt-1 text-[11px] leading-relaxed text-[#8b949e]">
                        {pessoaHub ? (
                          <>
                            <span className="text-[#6b7280]">Participante</span>{" "}
                            {pessoaHub.nome ? (
                              <span className="text-gray-300">{pessoaHub.nome}</span>
                            ) : (
                              <span className="text-[#8b949e]">(sem nome cadastrado)</span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="text-[#6b7280]">Sem pessoa vinculada a este lead</span>
                            {" · "}
                            <span>entrada manual — vincule um contato existente.</span>
                          </>
                        )}
                      </p>
                      {!pessoaHub ? <VincularPessoaLead leadId={id} /> : null}
                      <p className="mt-2 text-xs leading-relaxed text-[#8b949e]">
                        <span className="text-gray-300">{(lead.telefone as string) || "—"}</span>
                        {" · "}
                        <span>{(lead.origem as string) || "—"}</span>
                        {" · "}
                        <span>
                          score{" "}
                          {`${Number(lead.score ?? 0)}/100`}
                        </span>
                        {" · "}
                        <span>
                          {(lead.agente_responsavel as string) || "—"} /{" "}
                          {(lead.humano_responsavel as string) || "IA"}
                        </span>
                      </p>
                    </div>
                    <span
                      className="shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide"
                      style={{
                        backgroundColor: `${corEstagio}20`,
                        color: corEstagio,
                        border: `1px solid ${corEstagio}44`,
                      }}
                    >
                      {estagioLabel}
                    </span>
                  </div>

                  {parceiroId ? (
                    <div
                      className="mb-4 rounded-lg border px-4 py-3"
                      style={{ borderColor: "#c9a24a44", background: "#c9a24a10" }}
                    >
                      <p className="text-[11px] font-bold uppercase tracking-wide text-[#c9a24a]">
                        Profissional atribuído
                      </p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {parceiroNome || "Parceiro"}{" "}
                        <span className="text-xs font-normal text-[#8b949e]">({parceiroPapel})</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => router.push(`/crm/parceiros/${parceiroId}`)}
                        className="mt-2 text-xs font-semibold text-[#c9a24a] hover:underline"
                      >
                        Ver ficha PAR →
                      </button>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-4 lg:gap-y-3">
                    {camposDados.map((f) =>
                      f.field ? (
                        <CampoDadoEditavel
                          key={f.label}
                          label={f.label}
                          value={f.value}
                          rawValue={f.rawValue ?? ""}
                          editType={f.editType ?? "text"}
                          borderColor={BORDER_SUBTLE}
                          cardBg={CARD_INNER}
                          onSave={(v) => salvarCampo(f.field as string, v)}
                        />
                      ) : (
                        <div
                          key={f.label}
                          className="rounded-lg border px-3 py-2.5 transition-colors hover:bg-white/[0.02]"
                          style={{
                            borderColor: BORDER_SUBTLE,
                            backgroundColor: CARD_INNER,
                          }}
                        >
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6b7280]">
                            {f.label}
                          </p>
                          <p className="mt-1 break-words text-sm font-medium leading-snug text-gray-100">
                            {f.value}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </article>
              </div>

              {/* Rodapé de ações removido: era duplicata do header (Central, Converter) + barra
                  (Perdido) e formava um par ✓verde/✗vermelho que imitava ganho/perdido de venda
                  sobre um LEAD. Ações agora vivem em UM lugar. AUDITORIA-CICLO-LEAD-v1.md. */}
            </div>
          )}
      </div>
    </div>
  );
}

/**
 * Campo editável inline da aba Dados — reusa o PATCH allowlist do lead (sem rota nova).
 * Click-and-Go: clica no valor → vira input → Enter/blur salva, Esc cancela. Vazio mostra
 * "adicionar +" em vez de "—" (mata a percepção de dado inútil). AUDITORIA-CICLO-LEAD-v1.md.
 */
function CampoDadoEditavel({
  label,
  value,
  rawValue,
  editType,
  borderColor,
  cardBg,
  onSave,
}: {
  label: string;
  value: string;
  rawValue: string;
  editType: "text" | "number" | "email";
  borderColor: string;
  cardBg: string;
  onSave: (valor: string) => Promise<boolean>;
}) {
  const [editando, setEditando] = useState(false);
  const [draft, setDraft] = useState(rawValue);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!editando) setDraft(rawValue);
  }, [rawValue, editando]);

  async function commit() {
    if (salvando) return;
    if (draft.trim() === rawValue.trim()) {
      setEditando(false);
      return;
    }
    setSalvando(true);
    const ok = await onSave(draft);
    setSalvando(false);
    if (ok) setEditando(false);
  }

  const vazio = value === "—" || value.trim() === "";

  return (
    <div
      className="group rounded-lg border px-3 py-2.5 transition-colors hover:bg-white/[0.02]"
      style={{ borderColor, backgroundColor: cardBg }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6b7280]">{label}</p>
      {editando ? (
        <input
          autoFocus
          type={editType === "number" ? "number" : editType === "email" ? "email" : "text"}
          inputMode={editType === "number" ? "decimal" : undefined}
          value={draft}
          disabled={salvando}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") void commit();
            if (e.key === "Escape") {
              setDraft(rawValue);
              setEditando(false);
            }
          }}
          className="mt-1 w-full rounded border bg-transparent px-1.5 py-1 text-sm text-gray-100 outline-none focus:border-[#c9a24a]"
          style={{ borderColor }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="mt-1 flex w-full items-start justify-between gap-1.5 text-left"
        >
          <span
            className={`break-words text-sm font-medium leading-snug ${vazio ? "text-[#6b7280]" : "text-gray-100"}`}
          >
            {vazio ? "adicionar +" : value}
          </span>
          <Pencil
            className="mt-0.5 h-3 w-3 shrink-0 text-[#6b7280] opacity-0 transition-opacity group-hover:opacity-100"
            strokeWidth={2}
            aria-hidden
          />
        </button>
      )}
    </div>
  );
}
