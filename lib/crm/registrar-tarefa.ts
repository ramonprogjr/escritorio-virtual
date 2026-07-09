import type { SupabaseClient } from "@supabase/supabase-js";
import { registrarEvento } from "@/lib/crm/registrar-evento";

/**
 * Gerenciador de tarefas UNIVERSAL. Cria/conclui tarefas em hub_tarefas_comerciais para QUALQUER
 * entidade (lead/pessoa/empresa/negócio/fornecedor/especialista/obra) via entity_type+entity_id.
 * A IA (Mari/copiloto) e o humano usam o MESMO helper. Loga um evento observacional (best-effort,
 * nunca quebra o fluxo) espelhando o padrão de registrarEvento.
 */

export type TarefaOrigem = "ia" | "humano";
export type TarefaPrioridade = "baixa" | "media" | "alta";

export type CriarTarefaInput = {
  titulo: string;
  descricao?: string | null;
  /** lead | pessoa | empresa | negocio | fornecedor | especialista | obra */
  entity_type?: string | null;
  entity_id?: string | null;
  /** Conveniência: se vier lead_id/negocio_id e não vier entity_*, resolve sozinho. */
  lead_id?: string | null;
  negocio_id?: string | null;
  responsavel_id?: string | null;
  prioridade?: TarefaPrioridade | string;
  /** ISO; a IA agenda uma ação futura aqui. */
  vencimento_em?: string | null;
  origem?: TarefaOrigem;
  ator?: string | null;
  tenant_id: string;
};

export type TarefaResult = { ok: true; id: string } | { ok: false; error: string };

const PRIORIDADES: ReadonlySet<string> = new Set(["baixa", "media", "alta"]);

export type TarefaRow = {
  tenant_id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  prioridade: string;
  origem: string;
  entity_type: string | null;
  entity_id: string | null;
  lead_id: string | null;
  negocio_id: string | null;
  responsavel_id: string | null;
  vencimento_em: string | null;
};

/** Constrói a linha de tarefa (pura, testável) — resolve entity, valida vencimento e prioridade. */
export function montarLinhaTarefa(input: CriarTarefaInput): TarefaRow | { erro: string } {
  const titulo = String(input.titulo ?? "").trim();
  if (!titulo) return { erro: "título obrigatório" };
  if (!input.tenant_id) return { erro: "tenant_id obrigatório" };

  let entityType = input.entity_type?.trim() || null;
  let entityId = input.entity_id?.trim() || null;
  if (!entityType && input.lead_id) {
    entityType = "lead";
    entityId = input.lead_id;
  }
  if (!entityType && input.negocio_id) {
    entityType = "negocio";
    entityId = input.negocio_id;
  }

  let vencimento: string | null = null;
  if (input.vencimento_em) {
    const t = Date.parse(String(input.vencimento_em));
    if (!Number.isNaN(t)) vencimento = new Date(t).toISOString();
  }
  const prioridade = PRIORIDADES.has(String(input.prioridade)) ? String(input.prioridade) : "media";

  return {
    tenant_id: input.tenant_id,
    titulo,
    descricao: input.descricao?.trim() || null,
    status: "aberta",
    prioridade,
    origem: input.origem === "ia" ? "ia" : "humano",
    entity_type: entityType,
    entity_id: entityId,
    lead_id: entityType === "lead" ? entityId : input.lead_id ?? null,
    negocio_id: entityType === "negocio" ? entityId : input.negocio_id ?? null,
    responsavel_id: input.responsavel_id ?? null,
    vencimento_em: vencimento,
  };
}

export async function criarTarefa(supabase: SupabaseClient, input: CriarTarefaInput): Promise<TarefaResult> {
  const linha = montarLinhaTarefa(input);
  if ("erro" in linha) return { ok: false, error: linha.erro };

  const { data, error } = await supabase.from("hub_tarefas_comerciais").insert(linha).select("id").single();
  if (error || !data?.id) return { ok: false, error: error?.message || "falha ao criar tarefa" };
  const id = String(data.id);

  await registrarEvento(supabase, {
    event_type: "tarefa_criada",
    entity_type: linha.entity_type,
    entity_id: linha.entity_id,
    lead_id: linha.lead_id,
    negocio_id: linha.negocio_id,
    ator: input.ator ?? (input.origem === "ia" ? "ia" : "humano"),
    payload: { tarefa_id: id, titulo: linha.titulo, prioridade: linha.prioridade, vencimento_em: linha.vencimento_em, origem: linha.origem },
    tenant_id: input.tenant_id,
  });

  return { ok: true, id };
}

/** Conclui uma tarefa (status=concluida + concluida_em) e loga — 'Feito' com histórico. */
export async function concluirTarefa(
  supabase: SupabaseClient,
  id: string,
  opts?: { ator?: string | null; tenant_id?: string | null }
): Promise<TarefaResult> {
  const agora = new Date().toISOString();
  const { data, error } = await supabase
    .from("hub_tarefas_comerciais")
    .update({ status: "concluida", concluida_em: agora, atualizado_em: agora })
    .eq("id", id)
    .select("id, entity_type, entity_id, lead_id, negocio_id, titulo")
    .single();
  if (error || !data?.id) return { ok: false, error: error?.message || "tarefa não encontrada" };

  await registrarEvento(supabase, {
    event_type: "tarefa_concluida",
    entity_type: (data.entity_type as string) ?? null,
    entity_id: (data.entity_id as string) ?? null,
    lead_id: (data.lead_id as string) ?? null,
    negocio_id: (data.negocio_id as string) ?? null,
    ator: opts?.ator ?? "humano",
    payload: { tarefa_id: id, titulo: data.titulo },
    tenant_id: opts?.tenant_id ?? null,
  });
  return { ok: true, id: String(data.id) };
}
