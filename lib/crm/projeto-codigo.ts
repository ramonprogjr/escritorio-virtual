/**
 * Geração do código de projeto PRJ-AAAA-NNNN — POR TENANT (A0).
 *
 * AUDITORIA-FIX (P0): o gerador antigo em /api/crm/projetos usava COUNT(*) GLOBAL
 * (sem .eq tenant_id) → vazava contagem entre empresas. Aqui chamamos a RPC
 * gerar_codigo_projeto(p_tenant) (atômica, por tenant). Espelha lib/obras/eap-presets
 * gerarCodigoObra. Fallback degradado: COUNT FILTRADO por tenant (nunca global).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_OBRA10_TENANT_ID } from "@/lib/tenant-default";

export async function gerarCodigoProjeto(
  supabase: SupabaseClient,
  tenantId: string
): Promise<string> {
  const tenant = tenantId?.trim() || DEFAULT_OBRA10_TENANT_ID;

  try {
    const { data, error } = await supabase.rpc("gerar_codigo_projeto", {
      p_tenant: tenant,
    });
    if (!error && typeof data === "string" && data) return data;
  } catch {
    /* cai no fallback abaixo */
  }

  // Fallback degradado — COUNT FILTRADO por tenant (nunca global).
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from("hub_projetos")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenant)
    .like("codigo", `PRJ-${year}-%`);
  const seq = String((count || 0) + 1).padStart(4, "0");
  return `PRJ-${year}-${seq}`;
}
