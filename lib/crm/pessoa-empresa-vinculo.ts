import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingPgColumn } from "@/lib/tenant-default";

export type VinculoPessoaEmpresaInput = {
  pessoa_id: string;
  empresa_id: string;
  cargo?: string | null;
  principal?: boolean;
  tenant_id?: string | null;
};

/** Cria ou actualiza vínculo pessoa ↔ empresa. */
export async function criarVinculoPessoaEmpresa(
  supabase: SupabaseClient,
  input: VinculoPessoaEmpresaInput
): Promise<{ ok: true; id?: string } | { ok: false; error: string }> {
  const row: Record<string, unknown> = {
    pessoa_id: input.pessoa_id,
    empresa_id: input.empresa_id,
    cargo: input.cargo?.trim() || "Representante",
    principal: input.principal ?? true,
  };
  if (input.tenant_id) row.tenant_id = input.tenant_id;

  let res = await supabase
    .from("hub_pessoas_empresas")
    .upsert(row, { onConflict: "pessoa_id,empresa_id" })
    .select("id")
    .maybeSingle();

  if (res.error && isMissingPgColumn(res.error, "tenant_id")) {
    delete row.tenant_id;
    res = await supabase
      .from("hub_pessoas_empresas")
      .upsert(row, { onConflict: "pessoa_id,empresa_id" })
      .select("id")
      .maybeSingle();
  }

  if (res.error) {
    const msg = res.error.message || "";
    if (msg.includes("does not exist") || msg.includes("hub_pessoas_empresas")) {
      return {
        ok: false,
        error: "Tabela hub_pessoas_empresas ausente. Aplique 20260528120000_hub_crm_pdf_refinamento.sql",
      };
    }
    return { ok: false, error: msg || "Falha ao criar vínculo." };
  }

  return { ok: true, id: res.data?.id ? String(res.data.id) : undefined };
}

export async function removerVinculoPessoaEmpresa(
  supabase: SupabaseClient,
  vinculoId: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("hub_pessoas_empresas").delete().eq("id", vinculoId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
