import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Quando chega mensagem nova no mesmo telefone, encerra jobs antigos pending/retry
 * para só a mensagem mais recente ser respondida (evita trava e fila presa).
 */
export async function supersedeJobsAntigosMesmoTelefone(
  supabase: SupabaseClient,
  telefone: string,
  jobIdManter: string
): Promise<number> {
  const tel = telefone.trim();
  if (!tel || !jobIdManter) return 0;

  // P0-3: pega as vítimas ANTES de encerrar (com o conteúdo). SÓ pending/retry — jobs em 'processing'
  // (LLM em voo) NÃO são mais mortos. E preserva a mensagem de cada vítima em hub_fila_mensagens, senão
  // a rajada típica ("Oi" + "tenho terreno, 300 mil" + "pode ligar?") perdia tudo menos a última.
  const { data: vitimas, error: errSel } = await supabase
    .from("hub_msg_jobs")
    .select("id, lead_id, tenant_id, agente_slug, message_id, payload")
    .eq("canal", "whatsapp")
    .eq("telefone", tel)
    .in("status", ["pending", "retry"])
    .neq("id", jobIdManter);
  if (errSel) {
    console.warn("[WEBHOOK] supersede jobs antigos (select):", errSel.message);
    return 0;
  }
  const lista = Array.isArray(vitimas) ? (vitimas as Array<Record<string, unknown>>) : [];
  if (lista.length === 0) return 0;

  for (const v of lista) {
    const payload = (v.payload && typeof v.payload === "object" ? v.payload : {}) as Record<string, unknown>;
    const conteudo = String(payload.mensagemFinal ?? payload.mensagem ?? payload.texto ?? "").trim();
    if (!conteudo || !v.lead_id) continue;
    const filaRow: Record<string, unknown> = {
      lead_id: v.lead_id,
      agente_id: typeof v.agente_slug === "string" ? v.agente_slug : null,
      remetente_numero: tel,
      canal: "whatsapp",
      direcao: "entrada",
      conteudo,
      status: "processado",
      tenant_id: v.tenant_id ?? null,
      metadata: { feito_por: "inbound", message_id: v.message_id ?? null, superseded: true },
    };
    const ins = await supabase.from("hub_fila_mensagens").insert(filaRow);
    if (ins.error) {
      const { tenant_id: _t, ...semTenant } = filaRow;
      await supabase.from("hub_fila_mensagens").insert(semTenant);
    }
  }

  const { data, error } = await supabase
    .from("hub_msg_jobs")
    .update({ status: "done", last_error: "superseded_by_newer_message", locked_at: null, locked_by: null })
    .in("id", lista.map((v) => v.id as string))
    .select("id");
  if (error) {
    console.warn("[WEBHOOK] supersede jobs antigos (update):", error.message);
    return 0;
  }
  return Array.isArray(data) ? data.length : 0;
}
