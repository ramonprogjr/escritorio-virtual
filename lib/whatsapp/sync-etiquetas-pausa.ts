import type { SupabaseClient } from "@supabase/supabase-js";
import { uazapiFetchJson } from "@/lib/whatsapp/uazapi-http";
import { telefoneConversaId } from "@/lib/crm/isolamento-conversa-lead";
import { invalidarCachePausas } from "@/lib/whatsapp/pausa-atendimento";
import { createHubLogger } from "@/lib/observability/hub-log";

/**
 * Espelha a etiqueta "pausa" do WhatsApp Business na deny-list (fonte='etiqueta').
 * Mecanismo confirmado por teste: GET /labels (acha o labelid) + POST /chat/find (cada chat traz wa_label).
 * NÃO há filtro server-side de label — filtra localmente. Ver docs/DESIGN-ATENDIMENTO-DEFINITIVO.md §1.3.
 * Fail-safe: qualquer erro na UAZAPI → mantém a deny-list como está (nunca limpa por engano).
 */

function normalizarNomeLabel(s: string): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Resolve o token da instância WhatsApp ativa (a Mari) para as chamadas UAZAPI. */
export async function resolverTokenInstanciaAtiva(
  supabase: SupabaseClient
): Promise<{ token: string; agenteSlug: string } | null> {
  const { data } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug, uazapi_instance_token")
    .eq("modo_operacao", "canal_whatsapp")
    .not("uazapi_instance_token", "is", null)
    .order("uazapi_snapshot_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = data as { agente_slug?: string; uazapi_instance_token?: string } | null;
  if (row?.uazapi_instance_token?.trim() && row.agente_slug) {
    return { token: row.uazapi_instance_token.trim(), agenteSlug: row.agente_slug };
  }
  return null;
}

export type ResultadoSyncEtiqueta = {
  ok: boolean;
  labelid?: string | null;
  totalNaEtiqueta?: number;
  adicionados?: number;
  removidos?: number;
  error?: string;
};

export async function sincronizarEtiquetaPausa(
  supabase: SupabaseClient,
  opts: { instanceToken: string; nomeEtiqueta?: string; tenantId?: string | null }
): Promise<ResultadoSyncEtiqueta> {
  const log = createHubLogger("sync_etiqueta_pausa");
  const alvo = normalizarNomeLabel(opts.nomeEtiqueta || "pausa");

  // 1) achar o labelid da etiqueta "pausa"
  const labs = await uazapiFetchJson<Array<{ name?: string; labelid?: string }>>("/labels", {
    method: "GET",
    instanceToken: opts.instanceToken,
  });
  if (!labs.ok) {
    log.warn("wa.pausas.labels_erro", { error: labs.error });
    return { ok: false, error: labs.error };
  }
  const lista = Array.isArray(labs.data) ? labs.data : [];
  const labelObj = lista.find((l) => normalizarNomeLabel(String(l?.name ?? "")) === alvo);
  const labelid = labelObj?.labelid ? String(labelObj.labelid) : null;
  if (!labelid) {
    // O dono ainda não criou a etiqueta "pausa" — no-op silencioso (nunca falha o pipeline).
    log.info("wa.pausas.label_ausente", { alvo });
    return { ok: true, labelid: null, totalNaEtiqueta: 0, adicionados: 0, removidos: 0 };
  }

  // 2) paginar /chat/find; coletar (a) telefones COM a etiqueta e (b) TODOS os telefones vistos.
  // Avança o offset pelo tamanho REAL da página (o servidor pode capar abaixo de `limit`) e só
  // considera a varredura COMPLETA quando uma página vem vazia — senão NÃO deleta nada (Crítico 1:
  // varredura truncada não pode apagar pausa de cliente ativo).
  const presentesSet = new Set<string>();
  const todosVistos = new Set<string>();
  const limit = 500;
  let offset = 0;
  let guard = 0;
  let scanCompleto = false;
  while (guard++ < 200) {
    const cf = await uazapiFetchJson<{ chats?: Array<{ phone?: string; wa_label?: string[] }> }>("/chat/find", {
      method: "POST",
      instanceToken: opts.instanceToken,
      body: { limit, offset },
    });
    if (!cf.ok) {
      log.warn("wa.pausas.chatfind_erro", { error: cf.error, offset });
      return { ok: false, error: cf.error }; // fail-safe: não mexe na deny-list
    }
    const chats = Array.isArray(cf.data?.chats) ? cf.data!.chats! : [];
    if (chats.length === 0) {
      scanCompleto = true;
      break;
    }
    for (const c of chats) {
      const tel = telefoneConversaId(String(c?.phone ?? ""));
      if (tel.length < 10) continue;
      todosVistos.add(tel);
      const labels = Array.isArray(c?.wa_label) ? c.wa_label : [];
      if (labels.some((wl) => String(wl).endsWith(`:${labelid}`))) presentesSet.add(tel);
    }
    offset += chats.length; // avança pelo tamanho REAL da página, nunca por `limit`
  }

  // 3) upsert dos presentes — adicionar é SEMPRE seguro.
  const presentes = Array.from(presentesSet);
  let adicionados = 0;
  if (presentes.length) {
    const rows = presentes.map((tel) => ({
      telefone: tel,
      fonte: "etiqueta" as const,
      labelid,
      motivo: `etiqueta:${alvo}`,
      criado_por: "sync",
      tenant_id: opts.tenantId ?? null,
    }));
    const { error } = await supabase
      .from("hub_atendimento_pausas")
      .upsert(rows, { onConflict: "telefone,fonte" });
    if (error) {
      log.warn("wa.pausas.upsert_erro", { error: error.message });
      return { ok: false, error: error.message };
    }
    adicionados = presentes.length;
  }

  // 4) delete SÓ com varredura completa e SÓ de telefones que EU VI sem a etiqueta. Cliente cujo
  // chat foi arquivado / ficou fora da varredura NUNCA é despausado por engano. Guarda de sanidade
  // contra remoção em massa (glitch de wa_label vazio devolvendo "todo mundo sem etiqueta").
  let removidos = 0;
  if (scanCompleto) {
    const { data: existentes } = await supabase
      .from("hub_atendimento_pausas")
      .select("id, telefone")
      .eq("fonte", "etiqueta");
    const existentesArr = Array.isArray(existentes) ? existentes : [];
    const idsRemover = existentesArr
      .filter((r) => {
        const tel = telefoneConversaId(String((r as { telefone?: string }).telefone ?? ""));
        return todosVistos.has(tel) && !presentesSet.has(tel);
      })
      .map((r) => (r as { id: string }).id);
    const limiteRemocao = Math.max(5, Math.ceil(existentesArr.length * 0.5));
    if (idsRemover.length > limiteRemocao) {
      log.warn("wa.pausas.remocao_massa_abortada", {
        remover: idsRemover.length,
        existentes: existentesArr.length,
        limite: limiteRemocao,
      });
    } else if (idsRemover.length) {
      const { error } = await supabase.from("hub_atendimento_pausas").delete().in("id", idsRemover);
      if (!error) removidos = idsRemover.length;
    }
  } else {
    log.warn("wa.pausas.scan_incompleto_sem_delete", { vistos: todosVistos.size });
  }

  invalidarCachePausas();
  log.info("wa.pausas.sync_ok", { labelid, totalNaEtiqueta: presentes.length, adicionados, removidos, scanCompleto });
  return { ok: true, labelid, totalNaEtiqueta: presentes.length, adicionados, removidos };
}
