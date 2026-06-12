import type { SupabaseClient } from "@supabase/supabase-js";
import { crmFeatureFlags } from "@/lib/crm/feature-flags";
import { insertHubEmpresaCrm, insertHubPessoaCrm } from "@/lib/crm/hub-insert-crm";
import { salvarSuperCadastro } from "@/lib/crm/salvar-super-cadastro";
import { validarSuperCadastro } from "@/lib/crm/validar-super-cadastro";
import type { PrefixoMercado } from "@/lib/crm/negocio-cadastro";
import { MERCADOS_PREFIXO } from "@/lib/crm/negocio-cadastro";
import { defaultTenantId } from "@/lib/tenant-default";

export type IaCriarCadastroInput = {
  nome: string;
  telefone: string;
  tipo_pessoa?: "PF" | "PJ";
  mercado?: string;
  origem?: string;
  email?: string | null;
  tenant_id?: string | null;
};

export async function iaCriarCadastroCrm(
  supabase: SupabaseClient,
  input: IaCriarCadastroInput
): Promise<{ ok: true; payload: Record<string, unknown> } | { ok: false; error: string }> {
  if (!crmFeatureFlags.iaAutoCadastro()) {
    return { ok: false, error: "CRM_IA_AUTO_CADASTRO desligado." };
  }

  const mercadoRaw = (input.mercado || "IMB").trim().toUpperCase();
  const mercado = MERCADOS_PREFIXO.includes(mercadoRaw as PrefixoMercado)
    ? (mercadoRaw as PrefixoMercado)
    : "IMB";

  const body = {
    tipo_pessoa: input.tipo_pessoa === "PJ" ? "PJ" : "PF",
    nome: input.nome.trim(),
    telefone: input.telefone.trim(),
    email: input.email?.trim() || null,
    comercial: {
      criar_lead: true,
      mercados: [mercado],
      lead_origem: input.origem?.trim() || "whatsapp",
    },
  };

  const validado = validarSuperCadastro(body);
  if (!validado.ok) {
    return { ok: false, error: validado.erro };
  }

  const tenantId = input.tenant_id?.trim() || defaultTenantId();
  const result = await salvarSuperCadastro(supabase, validado.data, {
    tenantId,
    insertHubPessoa: (row, tid) => insertHubPessoaCrm(supabase, row, tid),
    insertHubEmpresa: (row, tid) => insertHubEmpresaCrm(supabase, row, tid),
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return {
    ok: true,
    payload: {
      pessoa_id: result.pessoa_id,
      codigo_pessoa: result.codigo_pessoa,
      lead_id: result.lead_id,
      codigo_lead: result.codigo_lead,
      aviso: result.aviso,
    },
  };
}
