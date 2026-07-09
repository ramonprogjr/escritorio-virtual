import type { SupabaseClient } from "@supabase/supabase-js";
import { persistirParceiroNoLead } from "@/lib/crm/lead-parceiro-metadata";
import { registrarEvento } from "@/lib/crm/registrar-evento";
import { uazapiSendText } from "@/lib/whatsapp/uazapi-send";
import { defaultTenantId } from "@/lib/tenant-default";
import { montarCardResumoLead, formatarCardWhatsApp, type CardResumoLead } from "@/lib/crm/gerar-card-lead";

/** Valida o card-resumo cacheado em criterio_selecao.card_resumo. */
function asCardResumo(v: unknown): CardResumoLead | null {
  if (
    v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    typeof (v as { pedido_resumo?: unknown }).pedido_resumo === "string"
  ) {
    return v as CardResumoLead;
  }
  return null;
}

export type EnviarLeadParceiroResult =
  | { ok: true; telefone: string }
  | { ok: false; error: string };

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim()?.replace(/\/+$/, "") ||
    "http://localhost:3001"
  );
}

function parseCriterioEncaminhamento(raw: string | null | undefined): Record<string, unknown> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    return { parceiro_nome: raw };
  }
  return {};
}

/** Envia WhatsApp ao parceiro com dados do lead e actualiza métricas. */
export async function enviarLeadAoParceiro(
  supabase: SupabaseClient,
  encaminhamentoId: string,
  opts?: { parceiro_id?: string; instanceToken?: string | null }
): Promise<EnviarLeadParceiroResult> {
  const { data: enc, error: encErr } = await supabase
    .from("hub_encaminhamentos")
    .select("*")
    .eq("id", encaminhamentoId)
    .maybeSingle();

  if (encErr || !enc) {
    return { ok: false, error: encErr?.message || "Encaminhamento não encontrado." };
  }

  const criterio = parseCriterioEncaminhamento(enc.criterio_selecao as string | null);
  const parceiroId = opts?.parceiro_id ?? (criterio.parceiro_id as string | undefined);
  if (!parceiroId) {
    return { ok: false, error: "Parceiro não definido no encaminhamento." };
  }

  const { data: parceiro } = await supabase
    .from("hub_parceiros")
    .select("id, nome, telefone, codigo, total_leads_recebidos, status_financeiro")
    .eq("id", parceiroId)
    .maybeSingle();

  if (!parceiro?.telefone) {
    return { ok: false, error: "Parceiro sem telefone cadastrado." };
  }

  // GATE financeiro: fornecedor bloqueado por pendência não recebe novos leads.
  // Sinaliza o Hub (evento) — o admin pode liberar manualmente ou ao sanar a pendência.
  if (String((parceiro as { status_financeiro?: string }).status_financeiro ?? "em_dia") === "bloqueado") {
    await registrarEvento(supabase, {
      event_type: "gate_pendencia_bloqueio",
      entity_type: "encaminhamento",
      entity_id: encaminhamentoId,
      fornecedor_id: parceiroId,
      lead_id: (enc.lead_id as string) ?? null,
      ator: "sistema",
      payload: {
        parceiro_nome: parceiro.nome,
        segmento: (enc.segmento as string) ?? null,
        parceiro_codigo: (parceiro as { codigo?: string }).codigo ?? null,
      },
      tenant_id: (enc.tenant_id as string) ?? null,
    });
    return {
      ok: false,
      error: `${parceiro.nome} está bloqueado por pendência financeira. Sane ou libere antes de encaminhar.`,
    };
  }

  const leadId = enc.lead_id as string;
  const { data: lead } = await supabase
    .from("hub_leads_crm")
    .select("id, nome, telefone, codigo, metadata, estagio")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) {
    return { ok: false, error: "Lead não encontrado." };
  }

  const leadMeta =
    lead.metadata && typeof lead.metadata === "object" && !Array.isArray(lead.metadata)
      ? (lead.metadata as Record<string, unknown>)
      : {};

  // Card-resumo (§5, estilo Kommo): reaproveita o cache gerado no sugerir-encaminhamento; gera na
  // hora se faltar (cobre o caminho manual do DirecionarLeadDrawer). O card SEMPRE sai — se por
  // algum motivo falhar, cai no texto simples abaixo. Nunca bloqueia a atribuição do lead.
  let card: CardResumoLead | null = asCardResumo(criterio.card_resumo);
  if (!card) {
    try {
      card = await montarCardResumoLead(supabase, leadId);
    } catch (e) {
      console.warn("[distribuicao] montar card-resumo falhou (segue texto simples):", e);
    }
  }
  const texto = card
    ? formatarCardWhatsApp(card, { encaminhamentoId, appUrl: appUrl() })
    : [
        `🔔 *Novo lead para você!*`,
        ``,
        `*Nome:* ${lead.nome}${lead.codigo ? ` (${lead.codigo})` : ""}`,
        `*Telefone:* ${lead.telefone || "—"}`,
        ``,
        `Acesse o portal para aceitar ou recusar:`,
        `${appUrl()}/parceiro/dashboard`,
      ].join("\n");

  if (process.env.WHATSAPP_DRY_RUN === "1") {
    console.info("[distribuicao] DRY RUN parceiro:", parceiro.telefone, texto.slice(0, 80));
  } else {
    // Notificação é best-effort: a ATRIBUIÇÃO do lead ao fornecedor é a fonte da verdade e
    // não pode falhar porque o canal (WhatsApp/UAZAPI) está indisponível. Loga e segue —
    // a re-notificação pode ser feita depois.
    try {
      const send = await uazapiSendText(String(parceiro.telefone), texto, opts?.instanceToken);
      if (!send.ok) {
        console.warn("[distribuicao] WhatsApp ao parceiro falhou (segue com a atribuição):", send.error);
      }
    } catch (e) {
      console.warn("[distribuicao] WhatsApp ao parceiro lançou (segue com a atribuição):", e);
    }
  }

  const now = new Date().toISOString();
  await supabase
    .from("hub_encaminhamentos")
    .update({
      status: "enviado",
      enviado_em: now,
      validado_humano: true,
      encaminhado_para: parceiro.nome,
    })
    .eq("id", encaminhamentoId);

  await supabase
    .from("hub_leads_crm")
    .update({
      estagio: "encaminhado",
      estagio_funil: "encaminhado",
      atualizado_em: now,
    })
    .eq("id", leadId);

  const prefixoMercado = String(leadMeta.mercado_principal ?? "IMB").toUpperCase();
  const papel =
    prefixoMercado === "ARQ" || prefixoMercado === "PRO"
      ? ("arquiteto" as const)
      : prefixoMercado === "IMB"
        ? ("corretor" as const)
        : ("parceiro" as const);

  await persistirParceiroNoLead(supabase, leadId, {
    parceiro_id: parceiroId,
    parceiro_codigo: parceiro.codigo != null ? String(parceiro.codigo) : null,
    parceiro_nome: parceiro.nome != null ? String(parceiro.nome) : null,
    papel,
  });

  const total = (parceiro.total_leads_recebidos ?? 0) + 1;
  await supabase
    .from("hub_parceiros")
    .update({ total_leads_recebidos: total, atualizado_em: now })
    .eq("id", parceiroId);

  await registrarEvento(supabase, {
    event_type: "lead_distribuido",
    entity_type: "encaminhamento",
    entity_id: encaminhamentoId,
    fornecedor_id: parceiroId,
    lead_id: leadId,
    ator: "humano",
    payload: { parceiro_nome: parceiro.nome, score: criterio.score ?? null },
    tenant_id: (enc.tenant_id as string) ?? null,
  });

  return { ok: true, telefone: String(parceiro.telefone) };
}

/** Aprova encaminhamento sugerido pela IA e envia ao parceiro. */
export async function aprovarEEnviarEncaminhamento(
  supabase: SupabaseClient,
  encaminhamentoId: string,
  opts?: { parceiro_id?: string; instanceToken?: string | null }
): Promise<EnviarLeadParceiroResult> {
  const { data: enc } = await supabase
    .from("hub_encaminhamentos")
    .select("status")
    .eq("id", encaminhamentoId)
    .maybeSingle();

  if (!enc) return { ok: false, error: "Encaminhamento não encontrado." };

  const status = String(enc.status ?? "");
  if (status !== "aguardando_validacao" && status !== "sugerido_ia" && status !== "aprovado_envio") {
    return { ok: false, error: `Status inválido para aprovação: ${status}` };
  }

  await supabase
    .from("hub_encaminhamentos")
    .update({ status: "aprovado_envio", validado_humano: true })
    .eq("id", encaminhamentoId);

  return enviarLeadAoParceiro(supabase, encaminhamentoId, opts);
}
