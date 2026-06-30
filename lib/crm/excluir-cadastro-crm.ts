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

function parseRpcRow(data: unknown): RpcDeleteResult {
  if (!data || typeof data !== "object") {
    return { ok: false, error: "Resposta inválida do servidor." };
  }
  const row = data as Record<string, unknown>;
  return {
    ok: row.ok === true,
    error: typeof row.error === "string" ? row.error : undefined,
    id: typeof row.id === "string" ? row.id : undefined,
    codigo: row.codigo != null ? String(row.codigo) : null,
    nome: row.nome != null ? String(row.nome) : null,
    razao_social: row.razao_social != null ? String(row.razao_social) : null,
  };
}

/**
 * Confina a exclusão ao tenant do caller (a RPC só recebe `p_id` e não filtra tenant; o
 * service-role bypassa RLS). Verifica posse ANTES de chamar a RPC: 404 se o registo for de
 * outro escritório. NULL / Obra10 padrão = legado partilhado (acessível por todos, como nas
 * listas via tenantScopeOrFilter). Omitir `tenantId` mantém o comportamento global legado.
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
  if (msg.includes("vinculad") || msg.includes("Não é possível excluir")) return 409;
  if (msg.includes("inválid")) return 400;
  if (
    msg.includes("delete_authorized") ||
    (msg.includes("function") && msg.includes("does not exist"))
  ) {
    return 503;
  }
  return 500;
}

/** Exclui contacto via RPC (SET LOCAL app.delete_authorized), confinado ao tenant do caller. */
export async function excluirPessoaCrm(
  supabase: SupabaseClient,
  pessoaId: string,
  tenantId?: string | null
): Promise<{ result: RpcDeleteResult; httpStatus: number }> {
  const posse = await posseDoTenant(supabase, "hub_pessoas", pessoaId, tenantId);
  if (!posse.ok) return { result: posse.result, httpStatus: posse.httpStatus };

  const { data, error } = await supabase.rpc("hub_delete_pessoa_crm", { p_id: pessoaId });

  if (error) {
    const msg = error.message || "Falha ao excluir contacto.";
    return { result: { ok: false, error: msg }, httpStatus: statusFromMessage(msg) };
  }

  const result = parseRpcRow(data);
  if (!result.ok) {
    return {
      result,
      httpStatus: statusFromMessage(result.error || "Falha ao excluir."),
    };
  }
  return { result, httpStatus: 200 };
}

/** Exclui empresa via RPC (SET LOCAL app.delete_authorized), confinado ao tenant do caller. */
export async function excluirEmpresaCrm(
  supabase: SupabaseClient,
  empresaId: string,
  tenantId?: string | null
): Promise<{ result: RpcDeleteResult; httpStatus: number }> {
  const posse = await posseDoTenant(supabase, "hub_empresas", empresaId, tenantId);
  if (!posse.ok) return { result: posse.result, httpStatus: posse.httpStatus };

  const { data, error } = await supabase.rpc("hub_delete_empresa_crm", { p_id: empresaId });

  if (error) {
    const msg = error.message || "Falha ao excluir empresa.";
    return { result: { ok: false, error: msg }, httpStatus: statusFromMessage(msg) };
  }

  const result = parseRpcRow(data);
  if (!result.ok) {
    return {
      result,
      httpStatus: statusFromMessage(result.error || "Falha ao excluir."),
    };
  }
  return { result, httpStatus: 200 };
}
