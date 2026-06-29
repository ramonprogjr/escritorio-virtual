/**
 * A1 — Acesso a dados compartilhado entre as rotas de Programa/Aprovação e as
 * tools de IA. Concentra (1) a GUARDA de posse por tenant das fases e (2) o
 * recálculo do agregado, para não duplicar a lógica de segurança em cada rota.
 *
 * Tudo .eq('tenant_id', tenantId) PURO (nunca OR is.null) e tolerante a colunas
 * ausentes (pré-A0/A1 → degrada, nunca quebra).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingPgColumn } from "@/lib/tenant-default";
import { calcularAprovacaoProjeto, type ProjetoAprovacaoStatus } from "@/lib/crm/aprovacao-projeto";

/** Colunas SLA (A1). Pedidas no select estendido; o fallback as descarta. */
export const SELECT_FASE_APROVACAO =
  "id, projeto_id, nome, ordem, status, tipo, categoria, metragem_m2, observacao, " +
  "aprovacao_status, entregavel_url, aprovacao_enviado_em, aprovacao_respondido_em, aprovacao_motivo";

/** Subconjunto sem as colunas SLA do A1 (ambiente com A0 mas sem A1 aplicado). */
export const SELECT_FASE_BASE =
  "id, projeto_id, nome, ordem, status, tipo, categoria, metragem_m2, observacao, " +
  "aprovacao_status, entregavel_url";

export type FaseAprovacaoRow = {
  id: string;
  projeto_id: string;
  nome: string;
  tipo: string | null;
  categoria: string | null;
  aprovacao_status: string | null;
  entregavel_url: string | null;
  aprovacao_enviado_em?: string | null;
  aprovacao_respondido_em?: string | null;
  aprovacao_motivo?: string | null;
};

/** True se o projeto é do tenant do caller (match estrito por tenant). */
export async function projetoDoTenant(
  supabase: SupabaseClient,
  projetoId: string,
  tenantId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("hub_projetos")
    .select("id")
    .eq("id", projetoId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return Boolean(data?.id);
}

/**
 * Carrega a fase com posse ESTRITA: id da fase + projeto_id + tenant_id. Fecha
 * IDOR de faseId de outro tenant/projeto. Devolve:
 *  - a linha (com `slaDisponivel` indicando se as colunas A1 existem),
 *  - null (não encontrada / não pertence),
 *  - "sem_tenant" (ambiente pré-A0 sem a coluna tenant_id na tabela de fases).
 */
export async function carregarFaseDoProjetoTenant(
  supabase: SupabaseClient,
  faseId: string,
  projetoId: string,
  tenantId: string
): Promise<{ row: FaseAprovacaoRow; slaDisponivel: boolean } | null | "sem_tenant"> {
  // Tenta com as colunas SLA (A1). Cai pro base se faltarem; "sem_tenant" se a
  // própria coluna tenant_id não existe (ambiente muito antigo).
  let slaDisponivel = true;
  let res = await supabase
    .from("hub_projetos_fases")
    .select(SELECT_FASE_APROVACAO)
    .eq("id", faseId)
    .eq("projeto_id", projetoId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (res.error && isMissingPgColumn(res.error)) {
    slaDisponivel = false;
    res = await supabase
      .from("hub_projetos_fases")
      .select(SELECT_FASE_BASE)
      .eq("id", faseId)
      .eq("projeto_id", projetoId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
  }

  if (res.error) {
    if (isMissingPgColumn(res.error)) return "sem_tenant";
    return null;
  }
  if (!res.data) return null;
  return { row: res.data as unknown as FaseAprovacaoRow, slaDisponivel };
}

/**
 * Recalcula o agregado do projeto a partir das fases tipo='fase' e persiste em
 * hub_projetos.aprovacao_status. Tolerante (pré-A0 → no-op). Devolve o agregado.
 */
export async function recalcularAgregadoProjeto(
  supabase: SupabaseClient,
  projetoId: string,
  tenantId: string
): Promise<ProjetoAprovacaoStatus | null> {
  const { data, error } = await supabase
    .from("hub_projetos_fases")
    .select("aprovacao_status, tipo")
    .eq("projeto_id", projetoId)
    .eq("tenant_id", tenantId);
  if (error) return null; // pré-A0 (sem coluna tipo/aprovacao) → nada a agregar.

  const fases = (data ?? []).filter((f) => (f.tipo ?? "fase") === "fase");
  const agregado = calcularAprovacaoProjeto(fases.map((f) => f.aprovacao_status));

  await supabase
    .from("hub_projetos")
    .update({ aprovacao_status: agregado, atualizado_em: new Date().toISOString() })
    .eq("id", projetoId)
    .eq("tenant_id", tenantId);
  return agregado;
}
