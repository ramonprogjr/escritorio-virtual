import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatarCnpjMascara,
  formatarCpfMascara,
  normalizarDocumento,
} from "@/lib/crm/documento-brasil";
import { tenantScopeOrFilter } from "@/lib/tenant-default";

export type PessoaDocumentoRow = {
  id: string;
  nome: string | null;
  codigo: string | null;
  tipo_pessoa: string | null;
  documento: string | null;
};

/**
 * Procura pessoa pelo documento (só dígitos), aceitando gravação com ou sem máscara.
 *
 * Quando `tenantId` é informado, a busca é restrita ao tenant da sessão (mais
 * registos legados sem tenant) — evita que a dedup colida/vaze cross-tenant.
 * Omitir `tenantId` mantém o comportamento global legado (compatibilidade).
 *
 * NOTA: a constraint UNIQUE no banco ainda é GLOBAL (documento) — o insert pode
 * colidir entre tenants até a migração (tenant_id, documento) ser aplicada pelo
 * dono. Aqui só blindamos a busca da aplicação.
 */
export async function buscarPessoaPorDocumento(
  supabase: SupabaseClient,
  tipo: "PF" | "PJ",
  documentoDigits: string,
  tenantId?: string | null
): Promise<PessoaDocumentoRow | null> {
  const digits = normalizarDocumento(documentoDigits);
  if (!digits) return null;

  const mascarado = tipo === "PF" ? formatarCpfMascara(digits) : formatarCnpjMascara(digits);
  const variantes = [...new Set([digits, mascarado].filter(Boolean))];

  const tid = typeof tenantId === "string" ? tenantId.trim() : "";

  for (const doc of variantes) {
    let query = supabase
      .from("hub_pessoas")
      .select("id, nome, codigo, tipo_pessoa, documento")
      .eq("documento", doc);
    if (tid) query = query.or(tenantScopeOrFilter(tid));
    const { data } = await query.maybeSingle();
    if (data) return data as PessoaDocumentoRow;
  }

  return null;
}
