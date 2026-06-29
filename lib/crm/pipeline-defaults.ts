/** Estágios padrão Obra10 (leads e negócios). */
export const ESTAGIOS_PADRAO = [
  { slug: "novo", label: "Novos", cor: "#6B7280", ordem: 0, tipo_fecho: "aberto" as const },
  { slug: "qualificando", label: "Qualificando", cor: "#E0B86A", ordem: 1, tipo_fecho: "aberto" as const },
  { slug: "qualificado", label: "Qualificado", cor: "#C9A24A", ordem: 2, tipo_fecho: "aberto" as const },
  { slug: "proposta", label: "Proposta", cor: "#EAB308", ordem: 3, tipo_fecho: "aberto" as const },
  { slug: "negociando", label: "Negociando", cor: "#D6A129", ordem: 4, tipo_fecho: "aberto" as const },
  { slug: "fechamento", label: "Fechamento", cor: "#B8860B", ordem: 5, tipo_fecho: "aberto" as const },
  { slug: "ganho", label: "✓ Ganhos", cor: "#22C55E", ordem: 6, tipo_fecho: "ganho" as const },
  { slug: "perdido", label: "✗ Perdidos", cor: "#EF4444", ordem: 7, tipo_fecho: "perdido" as const },
] as const;

export type PipelineTipo = "lead" | "negocio" | "projeto";

/**
 * Limpa o nome do pipeline para exibição em cabeçalhos: remove o prefixo redundante
 * "<Módulo> — " (traço espaçado), que duplica o título da página. Ex.:
 * "Leads — Pipeline global" → "Pipeline global". Preserva hífens normais (ex.: "Pré-venda").
 */
export function limparNomePipeline(nome: string | null | undefined): string {
  const n = (nome ?? "").trim();
  if (!n) return "";
  return n.replace(/^.*?\s[—–]\s+/, "").trim() || n;
}

export type PipelineEstagioRow = {
  id: string;
  pipeline_id: string;
  slug: string;
  label: string;
  cor: string;
  ordem: number;
  ativo: boolean;
  tipo_fecho: "aberto" | "ganho" | "perdido";
  sistema: boolean;
};

export type PipelineRow = {
  id: string;
  slug: string;
  nome: string;
  tipo: PipelineTipo;
  mercado_sigla: string | null;
  ativo: boolean;
  ordem: number;
};

/** Fallback quando tabelas hub_pipelines ainda não existem no ambiente. */
export const ESTAGIOS_FALLBACK_UI = ESTAGIOS_PADRAO.map((e) => ({
  id: e.slug,
  label: e.label,
  color: e.cor,
}));
