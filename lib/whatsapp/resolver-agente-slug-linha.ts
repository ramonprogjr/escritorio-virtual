import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultTenantId } from "@/lib/tenant-default";
import type { LinhaWhatsAppWebhook } from "@/lib/whatsapp/resolver-linha-whatsapp";

/**
 * Slug do agente WhatsApp associado à linha inbound (instância ou único conectado).
 */
export async function resolverAgenteSlugWhatsappLinha(
  supabase: SupabaseClient,
  linhaWa: LinhaWhatsAppWebhook
): Promise<string | null> {
  if (linhaWa.kind === "agent_instance") {
    return linhaWa.agenteSlug.trim() || null;
  }

  const tid = defaultTenantId();
  const { data: rows, error } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug, tenant_id, modo_operacao, uazapi_connection_status, ativo, arquivado_em")
    .eq("modo_operacao", "canal_whatsapp")
    .eq("uazapi_connection_status", "connected")
    .eq("ativo", true);

  if (error || !rows?.length) return null;

  type Row = {
    agente_slug?: string;
    tenant_id?: string | null;
    arquivado_em?: string | null;
  };

  const candidatos = (rows as Row[]).filter((r) => {
    if (r.arquivado_em != null) return false;
    const t = typeof r.tenant_id === "string" ? r.tenant_id : null;
    return !t || t === tid;
  });

  if (candidatos.length !== 1) return null;
  const slug = typeof candidatos[0]?.agente_slug === "string" ? candidatos[0].agente_slug.trim() : "";
  return slug || null;
}
