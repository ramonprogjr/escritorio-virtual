import type { SupabaseClient } from "@supabase/supabase-js";
import { registrarLogCrm } from "@/lib/crm/audit-log";

export type EncaminhamentoInput = {
  lead_id: string;
  negocio_id?: string | null;
  destinatario_pessoa_id?: string | null;
  destinatario_empresa_id?: string | null;
  segmento?: string | null;
  responsavel_envio?: string | null;
  sugerido_ia?: boolean;
  validado_humano?: boolean;
  status?: string;
  criterio_selecao?: string | null;
  encaminhado_em?: string | null;
};

export type EncaminhamentoResult =
  | { ok: true; data: Record<string, unknown> & { id: string } }
  | { ok: false; error: string; status: number };

/**
 * Cria um encaminhamento (direcionar lead a parceiro/especialista) — o create + o **guard de POSSE
 * por tenant** (IDOR), extraído da rota para ser reusado por ela E pela tool de voz `hub_lead_encaminhar`
 * (DRY: uma única implementação do guard). NÃO dispara WhatsApp: o envio real ao parceiro vive no
 * endpoint SEPARADO `/encaminhamentos/[id]/aprovar` (2ª chave humana na tela). O `tenantId` vem SEMPRE
 * da sessão do caller, nunca do body/params. A tool de voz FORÇA status='sugerido_ia'/validado_humano=false.
 */
export async function criarEncaminhamentoPendente(
  supabase: SupabaseClient,
  tenantId: string,
  input: EncaminhamentoInput
): Promise<EncaminhamentoResult> {
  const lead_id = (input.lead_id || "").trim();
  if (!lead_id) return { ok: false, error: "lead_id obrigatório", status: 400 };

  // Guard de POSSE (IDOR): o lead informado precisa pertencer ao tenant do caller.
  const { data: lead, error: leadErr } = await supabase
    .from("hub_leads_crm")
    .select("id, tenant_id")
    .eq("id", lead_id)
    .maybeSingle();
  if (leadErr) return { ok: false, error: leadErr.message, status: 500 };
  if (!lead || (lead.tenant_id && lead.tenant_id !== tenantId)) {
    return { ok: false, error: "Lead não encontrado.", status: 404 };
  }

  const now = new Date().toISOString();
  const status = input.status || "aguardando_validacao";
  const row = {
    tenant_id: tenantId,
    lead_id,
    negocio_id: input.negocio_id ?? null,
    destinatario_pessoa_id: input.destinatario_pessoa_id ?? null,
    destinatario_empresa_id: input.destinatario_empresa_id ?? null,
    segmento: input.segmento ?? null,
    responsavel_envio: input.responsavel_envio ?? null,
    sugerido_ia: Boolean(input.sugerido_ia),
    validado_humano: Boolean(input.validado_humano),
    status,
    criterio_selecao: input.criterio_selecao ?? null,
    encaminhado_em: input.encaminhado_em ?? now,
    enviado_em: status === "enviado" ? now : null,
  };

  const { data, error } = await supabase
    .from("hub_encaminhamentos")
    .insert(row)
    .select()
    .single();
  if (error) return { ok: false, error: error.message, status: 500 };

  await supabase
    .from("hub_leads_crm")
    .update({ estagio_funil: "encaminhado", estagio: "encaminhado", atualizado_em: now })
    .eq("id", lead_id);

  await registrarLogCrm(supabase, {
    entidade: "encaminhamento",
    entidade_id: data.id,
    acao: "encaminhamento_criado",
    valor_novo: status,
    metadata: { lead_id },
  });

  return { ok: true, data: data as Record<string, unknown> & { id: string } };
}
