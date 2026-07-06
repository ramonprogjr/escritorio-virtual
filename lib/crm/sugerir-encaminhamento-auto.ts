import type { SupabaseClient } from "@supabase/supabase-js";
import { crmFeatureFlags } from "@/lib/crm/feature-flags";
import { listarCandidatosParceiro, type CandidatoParceiro } from "@/lib/crm/distribuir-lead";
import { defaultTenantId } from "@/lib/tenant-default";
import { legacyToFunil } from "@/lib/crm/estagio-map";

export type SugestaoEncaminhamentoResult =
  | {
      ok: true;
      encaminhamento_id: string;
      candidatos: CandidatoParceiro[];
      principal: CandidatoParceiro;
    }
  | { ok: false; error: string; candidatos?: CandidatoParceiro[] };

function mercadoDoLead(lead: Record<string, unknown>): string {
  const meta =
    lead.metadata && typeof lead.metadata === "object" && !Array.isArray(lead.metadata)
      ? (lead.metadata as Record<string, unknown>)
      : {};
  const mp = meta.mercado_principal ?? meta.mercado;
  if (typeof mp === "string" && mp.trim()) return mp.trim().toUpperCase();
  const mercados = meta.mercados;
  if (Array.isArray(mercados) && mercados[0]) return String(mercados[0]).trim().toUpperCase();
  return "IMB";
}

/** Cria encaminhamento aguardando validação com sugestão IA após lead qualificado. */
export async function sugerirEncaminhamentoAutomatico(
  supabase: SupabaseClient,
  leadId: string,
  opts?: { tenant_id?: string; responsavel?: string }
): Promise<SugestaoEncaminhamentoResult> {
  if (!crmFeatureFlags.distribuicaoAuto()) {
    return { ok: false, error: "Distribuição automática desactivada (CRM_DISTRIBUICAO_AUTO)." };
  }

  const { data: lead, error: leadErr } = await supabase
    .from("hub_leads_crm")
    .select("id, nome, telefone, estagio, metadata, pessoa_id, tenant_id")
    .eq("id", leadId)
    .maybeSingle();

  if (leadErr || !lead) {
    return { ok: false, error: leadErr?.message || "Lead não encontrado." };
  }

  // Gate no VOCABULÁRIO DO FUNIL visível (o que o write-path realmente grava). O legado gravava
  // "qualificado", mas a ficha normaliza tudo por legacyToFunil e "qualificado" colapsa em
  // "qualificando" — comparar contra o literal deixava o gate INALCANÇÁVEL pela tela (loop do
  // "Direcionar"). legacyToFunil aceita tanto o slug do funil quanto o legado, então ambos passam.
  const estagio = legacyToFunil(String(lead.estagio ?? ""));
  if (estagio !== "qualificando") {
    return { ok: false, error: "Lead não está qualificado." };
  }

  const { data: existente } = await supabase
    .from("hub_encaminhamentos")
    .select("id, status")
    .eq("lead_id", leadId)
    .in("status", ["aguardando_validacao", "sugerido_ia", "aprovado_envio", "enviado"])
    .limit(1)
    .maybeSingle();

  if (existente?.id) {
    return { ok: false, error: "Já existe encaminhamento pendente ou enviado para este lead." };
  }

  const meta =
    lead.metadata && typeof lead.metadata === "object" && !Array.isArray(lead.metadata)
      ? (lead.metadata as Record<string, unknown>)
      : {};

  let cidade: string | null = null;
  let estado: string | null = null;
  if (lead.pessoa_id) {
    const { data: pessoa } = await supabase
      .from("hub_pessoas")
      .select("cidade, estado")
      .eq("id", lead.pessoa_id)
      .maybeSingle();
    cidade = pessoa?.cidade ?? null;
    estado = pessoa?.estado ?? null;
  }

  const tenantId = opts?.tenant_id ?? (lead.tenant_id as string) ?? defaultTenantId();
  const mercado = mercadoDoLead(lead as Record<string, unknown>);
  const candidatos = await listarCandidatosParceiro(supabase, {
    mercado,
    cidade,
    estado,
    tenant_id: tenantId,
    limite: 5,
  });

  if (candidatos.length === 0) {
    return {
      ok: false,
      error: "Nenhum parceiro homologado disponível para este mercado/região.",
      candidatos: [],
    };
  }

  const principal = candidatos[0];
  const now = new Date().toISOString();
  const payloadCriterio = JSON.stringify({
    parceiro_id: principal.parceiro_id,
    parceiro_nome: principal.nome,
    parceiro_telefone: principal.telefone,
    score: principal.score,
    motivo: principal.motivo,
    candidatos,
  });

  const { data: enc, error: encErr } = await supabase
    .from("hub_encaminhamentos")
    .insert({
      lead_id: leadId,
      segmento: mercado,
      responsavel_envio: opts?.responsavel ?? "sistema_ia",
      sugerido_ia: true,
      validado_humano: false,
      status: "aguardando_validacao",
      criterio_selecao: payloadCriterio,
      encaminhado_para: principal.nome,
      encaminhado_em: now,
      tenant_id: tenantId,
    })
    .select("id")
    .single();

  if (encErr || !enc?.id) {
    return { ok: false, error: encErr?.message || "Falha ao criar encaminhamento.", candidatos };
  }

  await notificarGestoresEncaminhamento(supabase, {
    leadNome: String(lead.nome ?? "Lead"),
    parceiroNome: principal.nome,
    mercado,
  });

  return {
    ok: true,
    encaminhamento_id: String(enc.id),
    candidatos,
    principal,
  };
}

async function notificarGestoresEncaminhamento(
  supabase: SupabaseClient,
  opts: { leadNome: string; parceiroNome: string; mercado: string }
): Promise<void> {
  try {
    const { data: contatos } = await supabase
      .from("hub_contatos_notificacao")
      .select("telefone, canal")
      .eq("ativo", true)
      .eq("receber_encaminhamento", true);

    if (!contatos?.length) return;

    const msg = `📋 *Sugestão de encaminhamento (IA)*\n\n*Lead:* ${opts.leadNome}\n*Mercado:* ${opts.mercado}\n*Parceiro sugerido:* ${opts.parceiroNome}\n\nValide em CRM → Leads → Encaminhamentos pendentes.`;

    const { uazapiSendText } = await import("@/lib/whatsapp/uazapi-send");
    await Promise.allSettled(
      contatos
        .filter((c) => c.canal === "whatsapp" || c.canal === "ambos")
        .map((c) => uazapiSendText(String(c.telefone), msg))
    );
  } catch (e) {
    console.error("[distribuicao] notificar gestores:", e);
  }
}
