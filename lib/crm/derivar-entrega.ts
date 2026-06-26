import type { SupabaseClient } from "@supabase/supabase-js";
import { registrarLogCrm } from "@/lib/crm/audit-log";
import { resolverTipoDerivado, type TipoDerivado } from "@/lib/crm/derivar-negocio";

export type EntregaDerivada = {
  id: string;
  codigo: string;
  titulo: string;
  status: string;
  negocio_id: string;
};

export type DerivarEntregaResult =
  | { ok: true; data: EntregaDerivada; tipo: TipoDerivado; ja_existia: boolean }
  | { ok: false; error: string; status: number };

/**
 * Esteira de entrega — ao GANHAR um negócio, deriva a entrega (Obra/Projeto) na área certa.
 * Idempotente: se já houver derivado para o negócio, retorna o existente (não duplica).
 * Reusado pelo botão manual (converter-obra) e pelo gatilho AUTOMÁTICO ao fechar (PATCH etapa→ganho).
 * `origem` só muda o texto do log ("manual" vs "automático ao fechar").
 */
export async function derivarEntregaDoNegocio(
  supabase: SupabaseClient,
  negocioId: string,
  opts?: { override?: string | null; tenant_id?: string; origem?: "manual" | "automatica" }
): Promise<DerivarEntregaResult> {
  const { data: negocio, error: negErr } = await supabase
    .from("hub_negocios")
    .select("id, codigo, titulo, prefixo_mercado, status, etapa, lead_id, tenant_id")
    .eq("id", negocioId)
    .maybeSingle();

  if (negErr) return { ok: false, error: negErr.message, status: 500 };
  if (!negocio) return { ok: false, error: "Negócio não encontrado", status: 404 };

  const ganho =
    String(negocio.status) === "fechado_ganho" || String(negocio.etapa) === "ganho";
  if (!ganho) {
    return { ok: false, error: "Apenas negócios ganhos geram obra/projeto.", status: 409 };
  }

  const alvo = resolverTipoDerivado(negocio.prefixo_mercado as string, opts?.override);
  const tabela = alvo === "projeto" ? "hub_projetos" : "hub_obras";

  // Idempotência: já existe entrega para este negócio?
  const { data: existente } = await supabase
    .from(tabela)
    .select("id, codigo, titulo, status, negocio_id")
    .eq("negocio_id", negocioId)
    .limit(1)
    .maybeSingle();

  if (existente?.id) {
    return { ok: true, data: existente as EntregaDerivada, tipo: alvo, ja_existia: true };
  }

  const tenantId = opts?.tenant_id ?? (negocio.tenant_id as string);
  const titulo = String(negocio.titulo || `Negócio ${negocio.codigo ?? negocioId}`).slice(0, 200);
  const year = new Date().getFullYear();
  const { count } = await supabase.from(tabela).select("*", { count: "exact", head: true });
  const prefixoCodigo = alvo === "projeto" ? "PRJ" : "OBR";
  const codigo = `${prefixoCodigo}-${year}-${String((count || 0) + 1).padStart(4, "0")}`;

  const row =
    alvo === "projeto"
      ? { codigo, titulo, status: "briefing", negocio_id: negocioId, tenant_id: tenantId }
      : { codigo, titulo, status: "planejamento", negocio_id: negocioId, tenant_id: tenantId };

  const { data: criado, error: insErr } = await supabase
    .from(tabela)
    .insert(row)
    .select("id, codigo, titulo, status, negocio_id")
    .single();

  if (insErr) return { ok: false, error: insErr.message, status: 500 };

  const sufixoOrigem = opts?.origem === "automatica" ? " (automático ao fechar)" : "";
  await supabase.from("hub_atividades").insert({
    negocio_id: negocioId,
    lead_id: negocio.lead_id ?? null,
    tipo: "derivacao",
    descricao: `Negócio ganho → ${alvo === "projeto" ? "Projeto" : "Obra"} ${criado.codigo}${sufixoOrigem}`,
    feito_por: opts?.origem === "automatica" ? "sistema" : "humano",
    feito_por_tipo: "humano",
    tenant_id: tenantId,
  });

  await registrarLogCrm(supabase, {
    entidade: "negocio",
    entidade_id: negocioId,
    acao: alvo === "projeto" ? "derivou_projeto" : "derivou_obra",
    valor_anterior: null,
    valor_novo: String(criado.codigo),
    motivo: null,
    tenant_id: tenantId,
  });

  return { ok: true, data: criado as EntregaDerivada, tipo: alvo, ja_existia: false };
}
