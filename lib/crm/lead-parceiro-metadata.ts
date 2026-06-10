import type { SupabaseClient } from "@supabase/supabase-js";
import { crmFeatureFlags } from "@/lib/crm/feature-flags";

export type ParceiroLeadMeta = {
  parceiro_id: string;
  parceiro_codigo?: string | null;
  papel?: "corretor" | "arquiteto" | "parceiro";
  encaminhado_em?: string;
};

export function mergeLeadMetadata(
  existing: unknown,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  return { ...base, ...patch };
}

export function extrairParceiroDoLeadMetadata(metadata: unknown): ParceiroLeadMeta | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const m = metadata as Record<string, unknown>;
  const parceiroId = m.parceiro_id;
  if (typeof parceiroId !== "string" || !parceiroId.trim()) return null;
  const papelRaw = m.parceiro_papel ?? m.papel;
  const papel =
    papelRaw === "corretor" || papelRaw === "arquiteto" || papelRaw === "parceiro"
      ? papelRaw
      : "parceiro";
  return {
    parceiro_id: parceiroId.trim(),
    parceiro_codigo: m.parceiro_codigo != null ? String(m.parceiro_codigo) : null,
    papel,
    encaminhado_em: m.parceiro_encaminhado_em != null ? String(m.parceiro_encaminhado_em) : undefined,
  };
}

/** Grava parceiro no metadata do lead (merge seguro). Respeita flag CRM_VINCULO_PARCEIRO_AUTO. */
export async function persistirParceiroNoLead(
  supabase: SupabaseClient,
  leadId: string,
  opts: {
    parceiro_id: string;
    parceiro_codigo?: string | null;
    parceiro_nome?: string | null;
    papel?: "corretor" | "arquiteto" | "parceiro";
    forcar?: boolean;
  }
): Promise<void> {
  if (!crmFeatureFlags.vinculoParceiroAuto() && !opts.forcar) return;

  const { data: lead } = await supabase
    .from("hub_leads_crm")
    .select("metadata")
    .eq("id", leadId)
    .maybeSingle();

  const merged = mergeLeadMetadata(lead?.metadata, {
    parceiro_id: opts.parceiro_id,
    parceiro_codigo: opts.parceiro_codigo ?? null,
    parceiro_nome: opts.parceiro_nome ?? null,
    parceiro_papel: opts.papel ?? "parceiro",
    parceiro_encaminhado_em: new Date().toISOString(),
  });

  await supabase
    .from("hub_leads_crm")
    .update({ metadata: merged, atualizado_em: new Date().toISOString() })
    .eq("id", leadId);
}
