/**
 * Lógica de handoff humano ↔ IA para o Inbox do CRM.
 * Usada tanto pelo assumir/devolver via UI quanto como helper para testes.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { defaultTenantId, isMissingPgColumn } from "@/lib/tenant-default";
import { telefoneConversaId } from "@/lib/crm/isolamento-conversa-lead";

export function crmHandoffDb(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ─── Identidade do operador ────────────────────────────────────────────────

export interface OperadorInfo {
  slug: string;
  nome: string;
  email: string;
  role: string;
}

/**
 * Resolve o operador logado a partir do auth_id (header x-caller-auth-id).
 * Retorna null se o auth_id não existir em public.users.
 */
export async function resolveOperador(
  supabase: SupabaseClient,
  authId: string
): Promise<OperadorInfo | null> {
  const { data, error } = await supabase
    .from("users")
    .select("id, auth_id, name, email, role, status")
    .eq("auth_id", authId)
    .maybeSingle();

  if (error || !data) return null;

  const status = String(data.status ?? "").toLowerCase();
  if (status && status !== "ativo") return null;

  return {
    slug: slugFromUser(data),
    nome: (data.name as string | null)?.trim() || (data.email as string).split("@")[0],
    email: (data.email as string) ?? "",
    role: (data.role as string) ?? "",
  };
}

/** Primeiro nome em minúsculas, ou prefixo do email — usado como humano_responsavel. */
export function slugFromUser(user: {
  name?: string | null;
  email?: string | null;
}): string {
  const name = user.name?.trim();
  if (name) return name.split(" ")[0].toLowerCase().slice(0, 40);
  const email = user.email?.trim();
  if (email) return email.split("@")[0].toLowerCase().slice(0, 40);
  return "operador";
}

// ─── Cancelar jobs de IA pendentes ────────────────────────────────────────

export async function cancelarJobsIa(
  supabase: SupabaseClient,
  telefone: string
): Promise<number> {
  const tel = telefoneConversaId(telefone);
  if (!tel) return 0;
  const { data, error } = await supabase
    .from("hub_msg_jobs")
    .update({
      status: "done",
      last_error: "human_takeover_crm",
      locked_at: null,
      locked_by: null,
    })
    .eq("canal", "whatsapp")
    .eq("telefone", tel)
    .in("status", ["pending", "retry", "processing"])
    .select("id");
  if (error) {
    console.warn("[HANDOFF] cancelar jobs:", error.message);
    return 0;
  }
  return Array.isArray(data) ? data.length : 0;
}

// ─── Assumir atendimento ────────────────────────────────────────────────────

export interface AssumirParams {
  leadId: string;
  operador: OperadorInfo;
  /** Origem do handoff — ex.: crm, whatsapp_comando, whatsapp_from_me */
  via?: string;
}

/** Converte operador WhatsApp (allowlist) em OperadorInfo mínimo. */
export function operadorInfoFromWhatsapp(op: { slug: string; nome: string }): OperadorInfo {
  return {
    slug: op.slug,
    nome: op.nome,
    email: "",
    role: "operador",
  };
}

export async function leadIdPorTelefone(
  supabase: SupabaseClient,
  telefone: string
): Promise<string | null> {
  const tel = telefoneConversaId(telefone);
  if (tel.length < 10) return null;
  const { data } = await supabase
    .from("hub_leads_crm")
    .select("id")
    .eq("telefone", tel)
    .maybeSingle();
  return data?.id ? String(data.id) : null;
}

export async function assumirAtendimentoCrm(
  supabase: SupabaseClient,
  params: AssumirParams
): Promise<{ ok: boolean; jobsCancelados: number; erro?: string }> {
  const { leadId, operador, via = "crm" } = params;
  const agora = new Date().toISOString();

  // Busca lead para obter telefone e metadata
  const { data: lead, error: leadErr } = await supabase
    .from("hub_leads_crm")
    .select("id, telefone, humano_responsavel, metadata")
    .eq("id", leadId)
    .maybeSingle();

  if (leadErr) return { ok: false, jobsCancelados: 0, erro: leadErr.message };
  if (!lead) return { ok: false, jobsCancelados: 0, erro: "Lead não encontrado" };

  const metaBase =
    typeof lead.metadata === "object" && lead.metadata !== null
      ? (lead.metadata as Record<string, unknown>)
      : {};

  const humanoAnterior =
    typeof lead.humano_responsavel === "string" && lead.humano_responsavel.trim()
      ? lead.humano_responsavel.trim()
      : null;

  const leadPatch: Record<string, unknown> = {
    humano_responsavel: operador.slug,
    atualizado_em: agora,
    ultimo_contato: agora,
    metadata: {
      ...metaBase,
      fase_atendimento: "atendimento_humano",
      humano_assumiu_em: agora,
      humano_assumiu_via: via,
      humano_nome: operador.nome,
      ...(humanoAnterior && humanoAnterior !== operador.slug
        ? { humano_anterior: humanoAnterior }
        : {}),
    },
  };

  let upd = await supabase.from("hub_leads_crm").update(leadPatch).eq("id", leadId);
  if (upd.error && isMissingPgColumn(upd.error, "ultimo_contato")) {
    const { ultimo_contato: _u, ...semUltimo } = leadPatch;
    upd = await supabase.from("hub_leads_crm").update(semUltimo).eq("id", leadId);
  }
  if (upd.error) return { ok: false, jobsCancelados: 0, erro: upd.error.message };

  // Cancela jobs de IA
  const telefone = typeof lead.telefone === "string" ? lead.telefone : "";
  const jobsCancelados = telefone ? await cancelarJobsIa(supabase, telefone) : 0;

  // Atualiza conversa ativa
  try {
    const { data: conv } = await supabase
      .from("hub_conversas")
      .select("id")
      .eq("lead_id", leadId)
      .eq("canal", "whatsapp")
      .is("encerrada_em", null)
      .maybeSingle();
    if (conv?.id) {
      await supabase
        .from("hub_conversas")
        .update({ ia_ativa: false, status: "em_atendimento_humano", ultima_mensagem_em: agora })
        .eq("id", conv.id);
    }
  } catch (e) {
    console.warn("[HANDOFF] hub_conversas update:", e);
  }

  // Atividade
  try {
    await supabase.from("hub_atividades").insert({
      lead_id: leadId,
      tipo: "ia_acao",
      descricao: `Atendimento assumido por ${operador.nome} via ${via}.`,
      feito_por: operador.slug,
      feito_por_tipo: "humano",
      metadata: { via, jobs_cancelados: jobsCancelados },
      tenant_id: defaultTenantId(),
    });
  } catch (e) {
    console.warn("[HANDOFF] atividade:", e);
  }

  return { ok: true, jobsCancelados };
}

// ─── Devolver à IA ─────────────────────────────────────────────────────────

export interface DevolverParams {
  leadId: string;
  operador: OperadorInfo;
  via?: string;
}

export async function assumirPorTelefone(
  supabase: SupabaseClient,
  telefoneLead: string,
  operador: OperadorInfo,
  via = "whatsapp_comando"
): Promise<{ ok: boolean; jobsCancelados: number; erro?: string }> {
  const leadId = await leadIdPorTelefone(supabase, telefoneLead);
  if (!leadId) return { ok: false, jobsCancelados: 0, erro: "Lead não encontrado para este telefone" };
  return assumirAtendimentoCrm(supabase, { leadId, operador, via });
}

export async function devolverPorTelefone(
  supabase: SupabaseClient,
  telefoneLead: string,
  operador: OperadorInfo,
  via = "whatsapp_comando"
): Promise<{ ok: boolean; erro?: string }> {
  const leadId = await leadIdPorTelefone(supabase, telefoneLead);
  if (!leadId) return { ok: false, erro: "Lead não encontrado para este telefone" };
  return devolverAtendimentoIA(supabase, { leadId, operador, via });
}

export async function devolverAtendimentoIA(
  supabase: SupabaseClient,
  params: DevolverParams
): Promise<{ ok: boolean; erro?: string }> {
  const { leadId, operador, via = "crm" } = params;
  const agora = new Date().toISOString();

  const { data: lead, error: leadErr } = await supabase
    .from("hub_leads_crm")
    .select("id, metadata")
    .eq("id", leadId)
    .maybeSingle();

  if (leadErr) return { ok: false, erro: leadErr.message };
  if (!lead) return { ok: false, erro: "Lead não encontrado" };

  const metaBase =
    typeof lead.metadata === "object" && lead.metadata !== null
      ? (lead.metadata as Record<string, unknown>)
      : {};

  const leadPatch: Record<string, unknown> = {
    humano_responsavel: null,
    atualizado_em: agora,
    metadata: {
      ...metaBase,
      fase_atendimento: "ia",
      ia_retomou_em: agora,
      devolvido_por: operador.slug,
    },
  };

  const upd = await supabase.from("hub_leads_crm").update(leadPatch).eq("id", leadId);
  if (upd.error) return { ok: false, erro: upd.error.message };

  // Reativa IA na conversa
  try {
    const { data: conv } = await supabase
      .from("hub_conversas")
      .select("id")
      .eq("lead_id", leadId)
      .eq("canal", "whatsapp")
      .is("encerrada_em", null)
      .maybeSingle();
    if (conv?.id) {
      await supabase
        .from("hub_conversas")
        .update({ ia_ativa: true, status: "aguardando", ultima_mensagem_em: agora })
        .eq("id", conv.id);
    }
  } catch (e) {
    console.warn("[HANDOFF] hub_conversas devolver:", e);
  }

  // Atividade
  try {
    await supabase.from("hub_atividades").insert({
      lead_id: leadId,
      tipo: "ia_acao",
      descricao: `Atendimento devolvido para a IA por ${operador.nome} via ${via}.`,
      feito_por: operador.slug,
      feito_por_tipo: "humano",
      metadata: { via },
      tenant_id: defaultTenantId(),
    });
  } catch (e) {
    console.warn("[HANDOFF] atividade devolver:", e);
  }

  return { ok: true };
}

// ─── Token UAZAPI por agente ────────────────────────────────────────────────

export async function tokenUazapiPorAgente(
  supabase: SupabaseClient,
  agenteSlug: string
): Promise<string | null> {
  const slug = agenteSlug.trim();
  if (!slug) return null;
  const { data } = await supabase
    .from("hub_agente_identidade")
    .select("uazapi_instance_token")
    .eq("agente_slug", slug)
    .maybeSingle();
  const token =
    typeof data?.uazapi_instance_token === "string"
      ? data.uazapi_instance_token.trim()
      : "";
  return token || null;
}
