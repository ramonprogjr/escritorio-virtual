import type { SupabaseClient } from "@supabase/supabase-js";
import { buscarPessoaPorDocumento } from "@/lib/crm/buscar-pessoa-documento";
import {
  documentoCompleto,
  documentoValido,
  mensagemDocumentoInvalido,
  normalizarDocumento,
} from "@/lib/crm/documento-brasil";
import type { TipoPessoaCadastro } from "@/lib/crm/pessoa-cadastro";

export async function validarDocumentoDisponivelPatch(
  supabase: SupabaseClient,
  tipo: TipoPessoaCadastro,
  documentoRaw: string | null | undefined,
  excluirPessoaId?: string
): Promise<{ ok: true; documento: string | null } | { ok: false; error: string }> {
  if (!documentoRaw?.trim()) return { ok: true, documento: null };

  const documento = normalizarDocumento(documentoRaw);
  if (!documento) return { ok: true, documento: null };

  if (!documentoCompleto(tipo, documento)) {
    const label = tipo === "PF" ? "CPF" : "CNPJ";
    return { ok: false, error: `${label} incompleto.` };
  }

  if (!documentoValido(tipo, documento)) {
    return { ok: false, error: mensagemDocumentoInvalido(tipo) };
  }

  const existente = await buscarPessoaPorDocumento(supabase, tipo, documento);
  if (existente && excluirPessoaId && String(existente.id) === excluirPessoaId) {
    return { ok: true, documento };
  }

  if (existente) {
    const label = tipo === "PF" ? "CPF" : "CNPJ";
    return {
      ok: false,
      error: `${label} já cadastrado para ${existente.nome} (${existente.codigo || "sem código"}).`,
    };
  }

  return { ok: true, documento };
}

export async function validarCnpjEmpresaDisponivelPatch(
  supabase: SupabaseClient,
  cnpjRaw: string | null | undefined,
  excluirEmpresaId?: string
): Promise<{ ok: true; cnpj: string | null } | { ok: false; error: string }> {
  if (!cnpjRaw?.trim()) return { ok: true, cnpj: null };
  const cnpj = normalizarDocumento(cnpjRaw);
  if (!cnpj) return { ok: true, cnpj: null };

  const { data } = await supabase
    .from("hub_empresas")
    .select("id, razao_social, codigo")
    .eq("cnpj", cnpj)
    .maybeSingle();

  if (data && excluirEmpresaId && String(data.id) === excluirEmpresaId) {
    return { ok: true, cnpj };
  }

  if (data) {
    return {
      ok: false,
      error: `CNPJ já cadastrado para ${data.razao_social} (${data.codigo || "sem código"}).`,
    };
  }

  return { ok: true, cnpj };
}
