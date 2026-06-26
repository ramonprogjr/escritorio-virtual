import type { SupabaseClient } from "@supabase/supabase-js";

export type EventoInput = {
  event_type: string;
  entity_type?: string | null;
  entity_id?: string | null;
  fornecedor_id?: string | null;
  lead_id?: string | null;
  negocio_id?: string | null;
  ator?: string | null;
  payload?: Record<string, unknown>;
  tenant_id?: string | null;
};

/**
 * Registra um evento estruturado no log append-only `hub_eventos` — keystone de KPIs/SLA/
 * auditoria/IAH (Central de Performance, F4). Best-effort: NUNCA lança nem bloqueia o fluxo
 * principal; o evento é um side-effect observacional. Ler depois para métricas/painel do Hub.
 */
export async function registrarEvento(supabase: SupabaseClient, ev: EventoInput): Promise<void> {
  try {
    await supabase.from("hub_eventos").insert({
      event_type: ev.event_type,
      entity_type: ev.entity_type ?? null,
      entity_id: ev.entity_id ?? null,
      fornecedor_id: ev.fornecedor_id ?? null,
      lead_id: ev.lead_id ?? null,
      negocio_id: ev.negocio_id ?? null,
      ator: ev.ator ?? null,
      payload: ev.payload ?? {},
      tenant_id: ev.tenant_id ?? null,
    });
  } catch (e) {
    console.warn("[hub_eventos] registrar evento falhou (segue):", e);
  }
}
