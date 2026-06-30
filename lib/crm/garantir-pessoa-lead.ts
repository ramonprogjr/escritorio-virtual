import type { SupabaseClient } from "@supabase/supabase-js";
import { buscarPessoaPorDocumento } from "@/lib/crm/buscar-pessoa-documento";
import { telefoneConversaId } from "@/lib/crm/isolamento-conversa-lead";
import { gerarCodigoPessoa } from "@/lib/crm/pessoa-cadastro";
import {
  documentoCompleto,
  normalizarDocumento,
} from "@/lib/crm/documento-brasil";
import {
  isMissingPgColumn,
  isTenantFkError,
  tenantScopeOrFilter,
} from "@/lib/tenant-default";

/**
 * CÓDIGO ÚNICO — garante UMA pessoa (hub_pessoas) para todo lead que entra (AUT-2).
 *
 * Espinha do "código único" (CPF/CNPJ = chave forte de dedup; telefone = chave
 * secundária). Centraliza a lógica que antes estava DUPLICADA e divergente em três
 * caminhos de intake:
 *   - /api/crm/leads      → vincularPessoaPorTelefone (telefone só)
 *   - /api/whatsapp/webhook → encontrarOuCriarPessoa (telefone canônico)
 *   - /api/leads (legado) → NÃO criava pessoa nenhuma (o gap principal)
 * e que o super-cadastro já fazia por completo (telefone + documento).
 *
 * Comportamento (não duplica · vincula · tenant-safe · race-safe):
 *   1. Se houver documento completo (CPF 11 / CNPJ 14): busca pessoa por documento
 *      escopada ao tenant (com/sem máscara). Achou → reaproveita (dedup forte).
 *   2. Senão (ou se não achou por documento): busca por telefone CANÔNICO (só dígitos,
 *      E.164 sem +) escopado ao tenant. Achou → reaproveita.
 *   3. Não achou → cria nova hub_pessoas com tenant_id (fallback p/ schema legado sem
 *      a coluna). Corrida no UNIQUE (23505) → re-busca a existente (telefone ou doc).
 *
 * Tenant-safe: busca e gravação SEMPRE escopadas no tenant — senão um lead do tenant A
 * se vincula a pessoa do tenant B (vazamento) e pessoa nova nasce órfã (tenant NULL).
 */

export type GarantirPessoaInput = {
  /** Telefone do lead (qualquer formato; será canonicalizado). */
  telefone?: string | null;
  /** Nome do lead (usado só se criar pessoa nova). */
  nome?: string | null;
  /** CPF/CNPJ (só dígitos ou com máscara) — chave FORTE de dedup quando completo. */
  documento?: string | null;
  /** Tipo do documento; default inferido pelo tamanho (11=PF, 14=PJ). */
  tipoPessoa?: "PF" | "PJ";
  /** Origem registrada na pessoa nova (ex.: "whatsapp", "site", "crm_manual"). */
  origem?: string | null;
  /** Mercados do lead (gravados em dados_extras da pessoa nova). */
  mercados?: string[];
};

export type GarantirPessoaResult = {
  /** Id da pessoa garantida (existente reaproveitada OU recém-criada), ou null se falhou. */
  pessoaId: string | null;
  /** Código PES da pessoa garantida (quando disponível). */
  codigo: string | null;
  /** true quando uma pessoa NOVA foi criada (false = reusou existente). */
  criada: boolean;
  /** Como a pessoa existente foi encontrada (null quando criou nova). */
  deduplicadaPor: "documento" | "telefone" | null;
};

const VAZIO: GarantirPessoaResult = {
  pessoaId: null,
  codigo: null,
  criada: false,
  deduplicadaPor: null,
};

function inferirTipoPessoa(
  documentoDigits: string,
  tipoExplicito?: "PF" | "PJ"
): "PF" | "PJ" {
  if (tipoExplicito) return tipoExplicito;
  return documentoDigits.length === 14 ? "PJ" : "PF";
}

/**
 * Garante a pessoa do lead (dedup por documento e/ou telefone; não duplica; vincula).
 * Idempotente para o mesmo CPF/telefone dentro do tenant.
 */
export async function garantirPessoaParaLead(
  supabase: SupabaseClient,
  tenantId: string,
  input: GarantirPessoaInput
): Promise<GarantirPessoaResult> {
  const tid = (tenantId || "").trim();
  const tenantScope = tenantScopeOrFilter(tid);

  const tel = telefoneConversaId(input.telefone);
  const telValido = tel.length >= 10 ? tel : "";

  const docDigits = input.documento ? normalizarDocumento(input.documento) : "";
  const tipoPessoa = inferirTipoPessoa(docDigits, input.tipoPessoa);
  const docCompleto = docDigits ? documentoCompleto(tipoPessoa, docDigits) : false;

  // Sem nenhuma chave de dedup (nem documento nem telefone) → não há como garantir
  // pessoa sem criar órfã/duplicada. Devolve vazio (o lead segue sem pessoa, como antes).
  if (!docCompleto && !telValido) return VAZIO;

  // ── 1) Dedup FORTE por documento (CPF/CNPJ) ───────────────────────────────
  if (docCompleto) {
    const porDoc = await buscarPessoaPorDocumento(supabase, tipoPessoa, docDigits, tid);
    if (porDoc?.id) {
      return {
        pessoaId: String(porDoc.id),
        codigo: porDoc.codigo != null ? String(porDoc.codigo) : null,
        criada: false,
        deduplicadaPor: "documento",
      };
    }
  }

  // ── 2) Dedup por telefone canônico (escopado no tenant) ───────────────────
  const buscarPorTelefone = async () => {
    if (!telValido) return null;
    const { data } = await supabase
      .from("hub_pessoas")
      .select("id, codigo")
      .eq("telefone", telValido)
      .or(tenantScope)
      .maybeSingle();
    return data ?? null;
  };

  const porTel = await buscarPorTelefone();
  if (porTel?.id) {
    return {
      pessoaId: String(porTel.id),
      codigo: (porTel as { codigo?: unknown }).codigo != null
        ? String((porTel as { codigo?: unknown }).codigo)
        : null,
      criada: false,
      deduplicadaPor: "telefone",
    };
  }

  // ── 3) Criar nova pessoa (vinculável ao lead) ─────────────────────────────
  const codigo = await gerarCodigoPessoa(supabase);
  const nome = (input.nome || "").trim().slice(0, 200) || "Lead";
  const origem = (input.origem || "crm_manual").trim().slice(0, 80) || "crm_manual";

  const rowBase: Record<string, unknown> = {
    codigo,
    nome,
    tipo: "lead",
    origem,
  };
  if (telValido) rowBase.telefone = telValido;
  if (docCompleto) {
    rowBase.documento = docDigits;
    rowBase.tipo_pessoa = tipoPessoa;
  }
  if (input.mercados?.length) rowBase.dados_extras = { mercados: input.mercados };

  // Tenta com tenant_id; se a coluna não existir / FK falhar no schema legado, regrava sem.
  const variantes: Record<string, unknown>[] = [
    { ...rowBase, tenant_id: tid },
    { ...rowBase },
  ];

  for (const payload of variantes) {
    const { data: nova, error } = await supabase
      .from("hub_pessoas")
      .insert(payload)
      .select("id, codigo")
      .single();

    if (!error && nova?.id) {
      return {
        pessoaId: String(nova.id),
        codigo: nova.codigo != null ? String(nova.codigo) : codigo,
        criada: true,
        deduplicadaPor: null,
      };
    }

    // Corrida: UNIQUE (telefone/documento) bateu → re-buscar a existente no tenant.
    if ((error as { code?: string } | null)?.code === "23505") {
      if (docCompleto) {
        const reDoc = await buscarPessoaPorDocumento(supabase, tipoPessoa, docDigits, tid);
        if (reDoc?.id) {
          return {
            pessoaId: String(reDoc.id),
            codigo: reDoc.codigo != null ? String(reDoc.codigo) : null,
            criada: false,
            deduplicadaPor: "documento",
          };
        }
      }
      const reTel = await buscarPorTelefone();
      if (reTel?.id) {
        return {
          pessoaId: String(reTel.id),
          codigo: (reTel as { codigo?: unknown }).codigo != null
            ? String((reTel as { codigo?: unknown }).codigo)
            : null,
          criada: false,
          deduplicadaPor: "telefone",
        };
      }
      // 23505 sem conseguir re-achar (ex.: outra coluna única) → desiste sem duplicar.
      return VAZIO;
    }

    // Schema legado sem tenant_id → tenta a próxima variante (sem a coluna).
    if (isTenantFkError(error) || isMissingPgColumn(error, "tenant_id")) {
      continue;
    }

    // Erro real (não recuperável) → não duplica; devolve vazio (lead segue sem pessoa).
    console.error("[garantirPessoaParaLead] insert pessoa:", error);
    return VAZIO;
  }

  return VAZIO;
}
