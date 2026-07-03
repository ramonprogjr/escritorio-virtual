import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_OBRA10_TENANT_ID, isMissingPgColumn } from "@/lib/tenant-default";

export type RpcDeleteResult = {
  ok: boolean;
  error?: string;
  id?: string;
  codigo?: string | null;
  nome?: string | null;
  razao_social?: string | null;
};

/**
 * Confina a exclusão ao tenant do caller (o service-role bypassa RLS). Verifica posse ANTES
 * de arquivar: 404 se o registo for de outro escritório. NULL / Obra10 padrão = legado
 * partilhado (acessível por todos, como nas listas via tenantScopeOrFilter). Omitir
 * `tenantId` mantém o comportamento global legado.
 */
async function posseDoTenant(
  supabase: SupabaseClient,
  tabela: "hub_pessoas" | "hub_empresas",
  id: string,
  tenantId?: string | null
): Promise<{ ok: true } | { ok: false; result: RpcDeleteResult; httpStatus: number }> {
  const tid = typeof tenantId === "string" ? tenantId.trim() : "";
  if (!tid) return { ok: true }; // sem tenant informado → comportamento legado (não bloqueia)

  const { data, error } = await supabase
    .from(tabela)
    .select("id, tenant_id")
    .eq("id", id)
    .maybeSingle();

  // Coluna tenant_id ausente (migração pendente) → não bloqueia (degrade gracioso).
  if (error && isMissingPgColumn(error, "tenant_id")) return { ok: true };
  if (error) {
    return { ok: false, result: { ok: false, error: error.message }, httpStatus: 500 };
  }
  if (!data) {
    return {
      ok: false,
      result: { ok: false, error: "Registo não encontrado." },
      httpStatus: 404,
    };
  }
  const rowTenant =
    (data as { tenant_id?: string | null }).tenant_id != null
      ? String((data as { tenant_id?: string | null }).tenant_id).trim()
      : "";
  if (rowTenant && rowTenant !== tid && rowTenant !== DEFAULT_OBRA10_TENANT_ID) {
    return {
      ok: false,
      result: { ok: false, error: "Registo não encontrado." },
      httpStatus: 404,
    };
  }
  return { ok: true };
}

function statusFromMessage(msg: string): number {
  if (msg.includes("não encontrad") || msg.includes("nao encontrad")) return 404;
  if (msg.includes("inválid")) return 400;
  if (msg.includes("arquivado_em") && msg.includes("does not exist")) return 503;
  return 500;
}

/**
 * Princípio do dono (02/jul/2026): NENHUMA ação de usuário do multi-tenant faz hard-delete —
 * o Hub SÓ ARQUIVA. Antes esta função chamava a RPC `hub_delete_pessoa_crm` (SECURITY DEFINER
 * com `SET LOCAL app.delete_authorized` + `DELETE FROM`), que destruía a linha. Agora faz um
 * soft-archive via `arquivado_em`: a pessoa PERMANECE no banco (auditoria/rastreio/merge) e os
 * vínculos com leads/negócios são preservados. O guard de tenant (posseDoTenant) é mantido.
 * A listagem (app/api/crm/pessoas/route.ts) esconde `arquivado_em IS NOT NULL`.
 * Usada por: DELETE /api/crm/pessoas/[id] e POST /api/crm/cadastro/bulk-delete.
 */
export async function excluirPessoaCrm(
  supabase: SupabaseClient,
  pessoaId: string,
  tenantId?: string | null
): Promise<{ result: RpcDeleteResult; httpStatus: number }> {
  const posse = await posseDoTenant(supabase, "hub_pessoas", pessoaId, tenantId);
  if (!posse.ok) return { result: posse.result, httpStatus: posse.httpStatus };

  const { data, error } = await supabase
    .from("hub_pessoas")
    .update({ arquivado_em: new Date().toISOString() })
    .eq("id", pessoaId)
    .select("id, codigo, nome")
    .maybeSingle();

  if (error) {
    const msg = error.message || "Falha ao arquivar contacto.";
    return { result: { ok: false, error: msg }, httpStatus: statusFromMessage(msg) };
  }
  if (!data) {
    return {
      result: { ok: false, error: "Registo não encontrado." },
      httpStatus: 404,
    };
  }
  const row = data as { id?: string; codigo?: string | null; nome?: string | null };
  return {
    result: {
      ok: true,
      id: row.id ?? pessoaId,
      codigo: row.codigo ?? null,
      nome: row.nome ?? null,
    },
    httpStatus: 200,
  };
}

/**
 * Soft-archive de empresa (mesmo princípio de excluirPessoaCrm). Antes: RPC
 * `hub_delete_empresa_crm` (DELETE FROM). Agora: `arquivado_em = now()` — a empresa PERMANECE
 * no banco. A listagem (app/api/crm/empresas/route.ts) esconde `arquivado_em IS NOT NULL`.
 * NB: usa `arquivado_em` (não `ativo`) de propósito — `ativo` é um toggle vivo de ativar/
 * desativar empresa, e reutilizá-lo colidiria com esse recurso.
 * Usada por: DELETE /api/crm/empresas/[id] e POST /api/crm/cadastro/bulk-delete.
 */
export async function excluirEmpresaCrm(
  supabase: SupabaseClient,
  empresaId: string,
  tenantId?: string | null
): Promise<{ result: RpcDeleteResult; httpStatus: number }> {
  const posse = await posseDoTenant(supabase, "hub_empresas", empresaId, tenantId);
  if (!posse.ok) return { result: posse.result, httpStatus: posse.httpStatus };

  const { data, error } = await supabase
    .from("hub_empresas")
    .update({ arquivado_em: new Date().toISOString() })
    .eq("id", empresaId)
    .select("id, codigo, razao_social")
    .maybeSingle();

  if (error) {
    const msg = error.message || "Falha ao arquivar empresa.";
    return { result: { ok: false, error: msg }, httpStatus: statusFromMessage(msg) };
  }
  if (!data) {
    return {
      result: { ok: false, error: "Registo não encontrado." },
      httpStatus: 404,
    };
  }
  const row = data as { id?: string; codigo?: string | null; razao_social?: string | null };
  return {
    result: {
      ok: true,
      id: row.id ?? empresaId,
      codigo: row.codigo ?? null,
      razao_social: row.razao_social ?? null,
    },
    httpStatus: 200,
  };
}
