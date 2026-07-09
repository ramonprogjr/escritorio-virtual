import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Timeline UNIVERSAL (hub_atividades). Um só helper para registrar atividade/nota em QUALQUER
 * entidade via entity_type+entity_id — automático (status_change, ação IA) ou manual (nota do usuário).
 * Best-effort: nunca lança (o log é observacional). Espelha o padrão de registrarEvento.
 * Preenche também a coluna legada (lead_id/negocio_id/pessoa_id) para compat com as fichas atuais.
 */

export type AtividadeFeitoPorTipo = "ia" | "humano" | "sistema";

export type AtividadeInput = {
  /** lead | pessoa | empresa | negocio | fornecedor | especialista | obra */
  entity_type: string;
  entity_id: string;
  /** nota | status_change | ia_acao | agendamento | ... (default: nota) */
  tipo?: string;
  descricao: string;
  feito_por?: string | null;
  feito_por_tipo?: AtividadeFeitoPorTipo | null;
  metadata?: Record<string, unknown>;
  tenant_id?: string | null;
};

export type AtividadeRow = {
  entity_type: string;
  entity_id: string;
  tipo: string;
  descricao: string;
  feito_por: string | null;
  feito_por_tipo: string;
  metadata: Record<string, unknown>;
  tenant_id: string | null;
  lead_id?: string;
  negocio_id?: string;
  pessoa_id?: string;
};

/** Constrói a linha (pura, testável) — resolve as colunas legadas a partir do entity_type. */
export function montarLinhaAtividade(a: AtividadeInput): AtividadeRow | { erro: string } {
  const entityType = String(a.entity_type ?? "").trim();
  const entityId = String(a.entity_id ?? "").trim();
  const descricao = String(a.descricao ?? "").trim();
  if (!entityType || !entityId) return { erro: "entity_type e entity_id obrigatórios" };
  if (!descricao) return { erro: "descrição obrigatória" };

  const row: AtividadeRow = {
    entity_type: entityType,
    entity_id: entityId,
    tipo: a.tipo?.trim() || "nota",
    descricao,
    feito_por: a.feito_por ?? null,
    feito_por_tipo: a.feito_por_tipo ?? "humano",
    metadata: a.metadata ?? {},
    tenant_id: a.tenant_id ?? null,
  };
  // Compat: preenche a coluna legada da entidade quando aplicável.
  if (entityType === "lead") row.lead_id = entityId;
  else if (entityType === "negocio") row.negocio_id = entityId;
  else if (entityType === "pessoa") row.pessoa_id = entityId;
  return row;
}

export async function registrarAtividade(
  supabase: SupabaseClient,
  a: AtividadeInput
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const linha = montarLinhaAtividade(a);
  if ("erro" in linha) return { ok: false, error: linha.erro };
  try {
    const { data, error } = await supabase.from("hub_atividades").insert(linha).select("id").single();
    if (error || !data?.id) return { ok: false, error: error?.message || "falha ao registrar atividade" };
    return { ok: true, id: String(data.id) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "erro" };
  }
}
