import {
  FUNIL_PARA_LEGADO_ESTAGIO,
  LEGADO_ESTAGIO_PARA_FUNIL,
  type FunilLeadSlug,
} from "@/lib/crm/pipelines";
import { crmFeatureFlags } from "@/lib/crm/feature-flags";

/** Slug canônico do funil PDF para exibição/agrupamento. */
export function legacyToFunil(estagio: string | null | undefined): FunilLeadSlug | string {
  const s = (estagio ?? "").trim();
  if (!s) return "novo";
  if (s in LEGADO_ESTAGIO_PARA_FUNIL) return LEGADO_ESTAGIO_PARA_FUNIL[s];
  if (Object.prototype.hasOwnProperty.call(FUNIL_PARA_LEGADO_ESTAGIO, s)) return s as FunilLeadSlug;
  return s;
}

/** Grava em `estagio` (legado) a partir do slug PDF. */
export function funilToLegacy(funil: string | null | undefined): string {
  const s = (funil ?? "").trim() as FunilLeadSlug;
  return FUNIL_PARA_LEGADO_ESTAGIO[s] ?? funil ?? "novo";
}

export type LeadEstagioPatch = {
  estagio?: string;
  estagio_funil?: string;
};

/** Monta patch de estágio para hub_leads_crm conforme feature flag. */
export function buildLeadEstagioPatch(novoFunilOuLegado: string): LeadEstagioPatch {
  const funil = legacyToFunil(novoFunilOuLegado) as string;
  if (crmFeatureFlags.pipelineV2()) {
    return {
      estagio_funil: funil,
      estagio: funil,
    };
  }
  return {
    estagio: funilToLegacy(funil),
    estagio_funil: funil,
  };
}

/** Slugs das COLUNAS do kanban de leads (pipeline de VENDAS em hub_pipeline_estagios). */
const COLUNAS_VENDAS = new Set([
  "novo", "qualificando", "qualificado", "proposta",
  "negociando", "fechamento", "ganho", "perdido",
]);

/**
 * Agrupa o lead na COLUNA do kanban. As colunas vêm do pipeline de VENDAS; mas o `estagio` do lead
 * pode estar no vocabulário do CICLO DE VIDA (encaminhado, aguardando_resposta, em_atendimento,
 * convertido_negocio, spam_invalido) — que NÃO tem coluna e fazia o lead SUMIR do board (L2/L3 do laudo:
 * 6 de 8 leads desapareciam). Aqui: se já é uma coluna de vendas, mantém; senão traduz ciclo-de-vida →
 * coluna de vendas via funilToLegacy(legacyToFunil(...)). O resultado é SEMPRE uma coluna existente.
 */
export function estagioParaColunaKanban(estagio: string | null | undefined): string {
  const s = (estagio ?? "").trim();
  if (!s) return "novo";
  if (COLUNAS_VENDAS.has(s)) return s;
  return funilToLegacy(legacyToFunil(s));
}
