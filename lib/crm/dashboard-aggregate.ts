import type { SupabaseClient } from "@supabase/supabase-js";
import { legacyToFunil } from "@/lib/crm/estagio-map";
import { ESTAGIOS_LEAD_TERMINAIS, metricasLeadsFromRows } from "@/lib/crm/estagio-filters";
import { safeCount } from "@/lib/crm/metricas-safe";
import { tenantScopeOrFilter } from "@/lib/tenant-default";
import type { PersonaCockpitPayload, PersonaCockpitTipo } from "@/lib/crm/persona-cockpit";
import { buildPersonaCockpit, type BuildPersonaOpts } from "@/lib/crm/persona-cockpit-aggregate";

export type CrmMetricas = {
  leadsHoje: number;
  leadsAguardando: number;
  aprovacoesPendentes: number;
  mensagensFilaPendentes: number;
  agentesAtivos: number;
  receitaPotencial: number;
  parceirosAtivos: number;
  encaminhamentosHoje: number;
  taxaQualificacao: number;
  taxaEncaminhamento: number;
};

export type AlertaResumo = {
  id: string;
  titulo: string;
  tipo: string;
  criado_em: string;
};

export type LeadRecente = {
  id: string;
  nome: string | null;
  estagio: string | null;
  criado_em: string;
  atualizado_em: string | null;
};

/**
 * Registros de teste/auditoria não aparecem na home (achado #5 da auditoria da dashboard:
 * "dado de TESTE na tela mais nobre de produção"). Heurística conservadora por nome — não
 * apaga nada no banco, só oculta da vitrine. Ver docs/AUDITORIA-DASHBOARD-CEO.md.
 */
export function ehRegistroDeTeste(nome?: string | null): boolean {
  if (!nome) return false;
  const n = nome.trim().toUpperCase();
  return n.startsWith("TESTE") || n.startsWith("[TESTE") || n.includes("AUDITORIA");
}

export type CicloStatus = {
  agente_slug: string;
  ultimo_status: string | null;
};

export type OperacaoResumo = {
  negociosAbertos: number;
  obrasEmAndamento: number;
  pedidosAbertos: number;
};

export type DashboardPayload = CrmMetricas & {
  alertas: AlertaResumo[];
  leadsRecentes: LeadRecente[];
  ciclos: CicloStatus[];
  operacao: OperacaoResumo;
};

/** Payload comercial marcado com a persona (discriminante do lado do cliente). */
export type CockpitComercial = DashboardPayload & { persona: "comercial" };

/**
 * Resposta persona-aware de aggregateDashboard: comercial (dashboard atual, preservado) OU o
 * cockpit de uma persona não-comercial. Discriminada pelo campo `persona`.
 */
export type CockpitResposta = CockpitComercial | PersonaCockpitPayload;

function inicioDiaUtcISO(): string {
  return new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())
  ).toISOString();
}

export async function fetchCrmMetricas(
  supabase: SupabaseClient,
  tenantId: string,
  since?: string
): Promise<CrmMetricas> {
  const sinceIso = since ?? inicioDiaUtcISO();

  const [
    leadsHoje,
    leadsRowsRes,
    aprovs,
    msgs,
    agentes,
    parceiros,
    encRowsRes,
  ] = await Promise.all([
    safeCount(
      supabase
        .from("hub_leads_crm")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .gte("criado_em", sinceIso)
    ),
    supabase
      .from("hub_leads_crm")
      .select("estagio, valor_estimado")
      .eq("tenant_id", tenantId),
    safeCount(
      supabase
        .from("hub_aprovacoes")
        .select("id", { count: "exact", head: true })
        .eq("status", "pendente")
        .or(tenantScopeOrFilter(tenantId))
    ),
    safeCount(
      supabase
        .from("hub_fila_mensagens")
        .select("id", { count: "exact", head: true })
        .eq("direcao", "entrada")
        .eq("status", "pendente")
        .or(tenantScopeOrFilter(tenantId))
    ),
    safeCount(
      supabase
        .from("hub_agente_identidade")
        .select("id", { count: "exact", head: true })
        .eq("ativo", true)
        .eq("tenant_id", tenantId)
    ),
    safeCount(
      supabase
        .from("hub_parceiros")
        .select("id", { count: "exact", head: true })
        .eq("status", "homologado")
        .or(tenantScopeOrFilter(tenantId))
    ),
    supabase
      .from("hub_encaminhamentos")
      .select("lead_id")
      .gte("encaminhado_em", sinceIso)
      .or(tenantScopeOrFilter(tenantId)),
  ]);

  const leadsRows = (leadsRowsRes.error ? [] : (leadsRowsRes.data ?? [])) as {
    estagio: string | null;
    valor_estimado?: number | null;
  }[];
  const leadMetricas = metricasLeadsFromRows(leadsRows, (e) => String(legacyToFunil(e)));
  const total = leadMetricas.total;
  const qualificados = leadMetricas.qualificados;
  const aguardando = leadMetricas.aguardando;
  const terminaisSet = new Set<string>(ESTAGIOS_LEAD_TERMINAIS);

  const receitaPotencial = leadsRows
    .filter((r) => !terminaisSet.has(String(legacyToFunil(r.estagio))))
    .reduce((s, r) => s + Number(r.valor_estimado ?? 0), 0);

  const encRows = encRowsRes.error ? [] : (encRowsRes.data ?? []) as { lead_id: string | null }[];
  const encaminhamentosHoje = encRows.length;
  const leadsComEncaminhamento = new Set(
    encRows.map((r) => r.lead_id).filter((id): id is string => id != null && id !== "")
  ).size;

  const taxaQualificacao = total > 0 ? Math.round((qualificados / total) * 100) : 0;
  const taxaEncaminhamento =
    total > 0 ? Math.round((leadsComEncaminhamento / total) * 100) : 0;

  return {
    leadsHoje,
    leadsAguardando: aguardando,
    aprovacoesPendentes: aprovs,
    mensagensFilaPendentes: msgs,
    agentesAtivos: agentes,
    receitaPotencial,
    parceirosAtivos: parceiros,
    encaminhamentosHoje,
    taxaQualificacao,
    taxaEncaminhamento,
  };
}

/**
 * Agrega o cockpit do /crm, agora PERSONA-AWARE (ADITIVO).
 *
 * `persona` default = "comercial" → comportamento HISTÓRICO intacto (retorna o DashboardPayload
 * atual, só marcado com `persona: "comercial"`). Personas não-comerciais (engenharia/arquiteto/
 * cliente/fornecedor) delegam ao buildPersonaCockpit. O papel vem SEMPRE da sessão (route →
 * getCallerContext), nunca do cliente; `opts.userId` só serve p/ escopar a obra do cliente.
 */
export async function aggregateDashboard(
  supabase: SupabaseClient,
  tenantId: string,
  since?: string,
  persona: PersonaCockpitTipo = "comercial",
  opts?: BuildPersonaOpts
): Promise<CockpitResposta> {
  if (persona !== "comercial") {
    return buildPersonaCockpit(supabase, tenantId, persona, opts);
  }

  const metricas = await fetchCrmMetricas(supabase, tenantId, since);

  const [alts, leads, cics, neg, obras, pedidos] = await Promise.all([
    supabase
      .from("hub_alertas")
      .select("id, titulo, tipo, criado_em")
      .eq("lido", false)
      .order("criado_em", { ascending: false })
      .limit(5),
    supabase
      .from("hub_leads_crm")
      .select("id, nome, estagio, criado_em, atualizado_em")
      .eq("tenant_id", tenantId)
      .order("atualizado_em", { ascending: false, nullsFirst: false })
      .limit(5),
    supabase.from("hub_ciclos_ia").select("agente_slug, ultimo_status").eq("ativo", true),
    safeCount(
      supabase
        .from("hub_negocios")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .in("status", ["aberto", "em_negociacao"])
    ),
    safeCount(
      supabase
        .from("hub_obras")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        // "Em andamento" = estados de EXECUÇÃO. O CHECK do schema NÃO tem 'em_andamento'
        // (é legado→'ativa'); filtrar só por ele zerava o KPI mesmo com obra ativa (QA).
        .in("status", ["ativa", "atencao", "critica", "mobilizacao", "em_andamento"])
    ),
    safeCount(
      supabase
        .from("hub_pedidos_material")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .in("status", ["rascunho", "cotando", "aprovado"])
    ),
  ]);

  let leadsRecentes: LeadRecente[] = [];
  if (!leads.error && leads.data) {
    leadsRecentes = leads.data as LeadRecente[];
  } else {
    const fallback = await supabase
      .from("hub_leads_crm")
      .select("id, nome, estagio, criado_em, atualizado_em")
      .eq("tenant_id", tenantId)
      .order("criado_em", { ascending: false })
      .limit(5);
    leadsRecentes = (fallback.data ?? []) as LeadRecente[];
  }
  // Vitrine limpa: registros de teste/auditoria não entram na home (auditoria dashboard #5).
  leadsRecentes = leadsRecentes.filter((l) => !ehRegistroDeTeste(l.nome));

  const alertas: AlertaResumo[] = !alts.error && alts.data
    ? alts.data.map((a) => ({
        id: String(a.id),
        titulo: String(a.titulo ?? "Alerta"),
        tipo: String(a.tipo ?? "info"),
        criado_em: String(a.criado_em),
      }))
    : [];

  const ciclos: CicloStatus[] = !cics.error && cics.data ? (cics.data as CicloStatus[]) : [];

  return {
    ...metricas,
    alertas,
    leadsRecentes,
    ciclos,
    operacao: {
      negociosAbertos: neg,
      obrasEmAndamento: obras,
      pedidosAbertos: pedidos,
    },
    persona: "comercial",
  };
}
