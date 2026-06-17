import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultTenantId, isMissingPgColumn } from "@/lib/tenant-default";

export type AgenteIaPauseState = {
  pausada: boolean;
  pausadaEm: string | null;
  pausadaPor: string | null;
  motivo: string | null;
};

const SELECT_PAUSE =
  "ia_whatsapp_pausada, ia_pausada_em, ia_pausada_por, ia_pausada_motivo";

export type RevalidacaoPausaGlobal = {
  pausada: boolean;
  lastError: "ia_global_pausada" | null;
};

/**
 * Revalida `ia_whatsapp_pausada` imediatamente antes do processor de IA.
 * Cobre corrida: lead enfileirado → operador envia `/ia-off` → worker descarta job.
 */
export async function revalidarPausaGlobalAntesProcessor(
  supabase: SupabaseClient,
  agenteSlug: string
): Promise<RevalidacaoPausaGlobal> {
  const pause = await lerPausaGlobalAgente(supabase, agenteSlug);
  if (pause.pausada) {
    return { pausada: true, lastError: "ia_global_pausada" };
  }
  return { pausada: false, lastError: null };
}

export async function lerPausaGlobalAgente(
  supabase: SupabaseClient,
  agenteSlug: string
): Promise<AgenteIaPauseState> {
  const slug = agenteSlug.trim();
  if (!slug) {
    return { pausada: false, pausadaEm: null, pausadaPor: null, motivo: null };
  }

  const { data, error } = await supabase
    .from("hub_agente_identidade")
    .select(SELECT_PAUSE)
    .eq("agente_slug", slug)
    .maybeSingle();

  if (error) {
    if (isMissingPgColumn(error, "ia_whatsapp_pausada")) {
      return { pausada: false, pausadaEm: null, pausadaPor: null, motivo: null };
    }
    console.warn("[WHATSAPP][IA_PAUSE] ler:", error.message);
    return { pausada: false, pausadaEm: null, pausadaPor: null, motivo: null };
  }

  return {
    pausada: data?.ia_whatsapp_pausada === true,
    pausadaEm: typeof data?.ia_pausada_em === "string" ? data.ia_pausada_em : null,
    pausadaPor: typeof data?.ia_pausada_por === "string" ? data.ia_pausada_por : null,
    motivo: typeof data?.ia_pausada_motivo === "string" ? data.ia_pausada_motivo : null,
  };
}

export async function definirPausaGlobalAgente(
  supabase: SupabaseClient,
  agenteSlug: string,
  pausada: boolean,
  opts?: { por?: string; motivo?: string }
): Promise<{ ok: boolean; erro?: string }> {
  const slug = agenteSlug.trim();
  if (!slug) return { ok: false, erro: "agente_slug_invalido" };

  const agora = new Date().toISOString();
  const patch = pausada
    ? {
        ia_whatsapp_pausada: true,
        ia_pausada_em: agora,
        ia_pausada_por: opts?.por?.slice(0, 80) ?? null,
        ia_pausada_motivo: opts?.motivo?.slice(0, 200) ?? "whatsapp_comando",
        atualizado_em: agora,
      }
    : {
        ia_whatsapp_pausada: false,
        ia_pausada_em: null,
        ia_pausada_por: null,
        ia_pausada_motivo: null,
        atualizado_em: agora,
      };

  const upd = await supabase.from("hub_agente_identidade").update(patch).eq("agente_slug", slug);

  if (upd.error) {
    if (isMissingPgColumn(upd.error, "ia_whatsapp_pausada")) {
      return { ok: false, erro: "migration_ia_whatsapp_pausada_pendente" };
    }
    return { ok: false, erro: upd.error.message };
  }

  return { ok: true };
}

/** Cancela jobs pendentes de todos os telefones quando a linha entra em pausa global. */
export async function cancelarJobsIaPendentesGlobal(
  supabase: SupabaseClient,
  agenteSlug: string
): Promise<number> {
  const slug = agenteSlug.trim();
  if (!slug) return 0;

  const { data, error } = await supabase
    .from("hub_msg_jobs")
    .update({
      status: "done",
      last_error: "ia_global_pausada",
      locked_at: null,
      locked_by: null,
    })
    .eq("canal", "whatsapp")
    .eq("agente_slug", slug)
    .in("status", ["pending", "retry", "processing"])
    .select("id");

  if (error) {
    console.warn("[WHATSAPP][IA_PAUSE] cancelar jobs global:", error.message);
    return 0;
  }
  return Array.isArray(data) ? data.length : 0;
}

const ALERTA_HORAS_DEFAULT = 4;

export async function maybeAlertarPausaGlobalProlongada(
  supabase: SupabaseClient,
  agenteSlug: string,
  state: AgenteIaPauseState
): Promise<void> {
  if (!state.pausada || !state.pausadaEm) return;

  const horasLimite = Number.parseInt(process.env.WHATSAPP_IA_PAUSE_ALERT_HORAS || "", 10);
  const limiteH = Number.isFinite(horasLimite) && horasLimite > 0 ? horasLimite : ALERTA_HORAS_DEFAULT;
  const pausadaMs = Date.now() - new Date(state.pausadaEm).getTime();
  if (pausadaMs < limiteH * 60 * 60 * 1000) return;

  try {
    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentes } = await supabase
      .from("hub_alertas")
      .select("id")
      .eq("agente_slug", agenteSlug)
      .eq("tipo", "importante")
      .gte("criado_em", desde)
      .ilike("titulo", "%IA WhatsApp pausada%")
      .limit(1);

    if (Array.isArray(recentes) && recentes.length > 0) return;

    await supabase.from("hub_alertas").insert({
      agente_slug: agenteSlug,
      tipo: "importante",
      titulo: "IA WhatsApp pausada há muito tempo",
      mensagem: `A linha do agente «${agenteSlug}» está com IA pausada desde ${state.pausadaEm}. Use /ia-on no WhatsApp ou reative no CRM.`,
      dados: {
        ia_pausada_em: state.pausadaEm,
        ia_pausada_por: state.pausadaPor,
        tenant_id: defaultTenantId(),
      },
    });
  } catch (e) {
    console.warn("[WHATSAPP][IA_PAUSE] alerta prolongada:", e);
  }
}
