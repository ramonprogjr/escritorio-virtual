import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultTenantId } from "@/lib/tenant-default";

export type LinhaWhatsAppWebhook =
  | {
      kind: "agent_instance";
      agenteSlug: string;
      instanceToken: string;
    }
  | { kind: "legacy_global_token" }
  | { kind: "ignored"; reason: string };

/**
 * Por mensagem inbound: só aceita linha ligada no Hub com WhatsApp **connected**
 * ou fallback legacy `UAZAPI_INSTANCE_TOKEN`.
 */
export async function resolverLinhaWhatsAppInbound(
  supabase: SupabaseClient,
  instanceId: string | undefined | null
): Promise<LinhaWhatsAppWebhook> {
  const tid = defaultTenantId();

  if (instanceId?.trim()) {
    const { data: row, error } = await supabase
      .from("hub_agente_identidade")
      .select(
        "agente_slug, modo_operacao, uazapi_instance_token, uazapi_connection_status, tenant_id, ativo, arquivado_em"
      )
      .eq("uazapi_instance_id", instanceId.trim())
      .maybeSingle();

    if (error) {
      console.warn("[WEBHOOK] resolver linha WhatsApp:", error.message);
      return { kind: "ignored", reason: "erro_bd_resolver_instancia" };
    }

    if (!row) {
      return { kind: "ignored", reason: "instancia_sem_agente_hub" };
    }

    const r = row as {
      agente_slug?: string;
      modo_operacao?: string | null;
      uazapi_instance_token?: string | null;
      uazapi_connection_status?: string | null;
      tenant_id?: string | null;
      ativo?: boolean | null;
      arquivado_em?: string | null;
    };

    if (r.arquivado_em != null || r.ativo === false) {
      return { kind: "ignored", reason: "agente_inativo_ou_arquivado" };
    }

    if (r.modo_operacao !== "canal_whatsapp") {
      return { kind: "ignored", reason: "agente_nao_modo_canal_whatsapp" };
    }

    const agentTenant = typeof r.tenant_id === "string" ? r.tenant_id : null;
    if (agentTenant && agentTenant !== tid) {
      return { kind: "ignored", reason: "tenant_instancia_incompativel" };
    }

    const token = typeof r.uazapi_instance_token === "string" ? r.uazapi_instance_token.trim() : "";
    const status = typeof r.uazapi_connection_status === "string" ? r.uazapi_connection_status.trim() : "";

    if (!token) {
      return { kind: "ignored", reason: "instancia_sem_token_em_hub" };
    }

    if (status !== "connected") {
      return { kind: "ignored", reason: "whatsapp_nao_conectado" };
    }

    const slug = typeof r.agente_slug === "string" ? r.agente_slug.trim() : "";
    if (!slug) {
      return { kind: "ignored", reason: "slug_agente_invalido" };
    }

    return { kind: "agent_instance", agenteSlug: slug, instanceToken: token };
  }

  if (process.env.UAZAPI_INSTANCE_TOKEN?.trim()) {
    return { kind: "legacy_global_token" };
  }

  return { kind: "ignored", reason: "instancia_desconhecida_sem_fallback_global" };
}
