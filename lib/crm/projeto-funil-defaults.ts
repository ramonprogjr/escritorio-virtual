/**
 * Defaults do FUNIL DE PROJETO (Arquitetura) — A0.
 *
 * Espelha lib/crm/pipeline-defaults.ts (que cobre lead/negócio). Os 7 estágios
 * abaixo são IDÊNTICOS ao seed da migração A0 (pipeline global 'projetos-arq').
 * O fallback in-code garante que o kanban /crm/arquitetura NUNCA fica em branco —
 * mesmo sem a migração aplicada nem o seed no banco (UI degrada graciosamente).
 *
 * Régua: funil EDITÁVEL — o dono pode renomear/reordenar via PipelineConfigSideover.
 * Estes são só os defaults de nascimento, não um enum rígido.
 */

/** Estágios padrão do funil de projeto (Arquitetura). Cores na marca verde+dourado dark. */
export const ESTAGIOS_PROJETO_PADRAO = [
  { slug: "briefing",    label: "Briefing",    cor: "#6B7280", ordem: 0, tipo_fecho: "aberto" as const },
  { slug: "estudo",      label: "Estudo",      cor: "#E0B86A", ordem: 1, tipo_fecho: "aberto" as const },
  { slug: "anteprojeto", label: "Anteprojeto", cor: "#C9A24A", ordem: 2, tipo_fecho: "aberto" as const },
  { slug: "executivo",   label: "Executivo",   cor: "#EAB308", ordem: 3, tipo_fecho: "aberto" as const },
  { slug: "aprovacao",   label: "Aprovação",   cor: "#D6A129", ordem: 4, tipo_fecho: "aberto" as const },
  { slug: "entregue",    label: "✓ Entregue",  cor: "#22C55E", ordem: 5, tipo_fecho: "ganho" as const },
  { slug: "arquivado",   label: "✗ Arquivado", cor: "#EF4444", ordem: 6, tipo_fecho: "perdido" as const },
] as const;

/** Slug de estágio válido por construção (defaults). Custom slugs validam-se no banco. */
export type ProjetoEstagioSlug = (typeof ESTAGIOS_PROJETO_PADRAO)[number]["slug"];

/** Fallback de UI quando hub_pipelines/seed ainda não existem no ambiente. */
export const ESTAGIOS_PROJETO_FALLBACK_UI = ESTAGIOS_PROJETO_PADRAO.map((e) => ({
  id: e.slug,
  label: e.label,
  color: e.cor,
}));

/** Slug do pipeline global de projeto (seed A0). */
export const PIPELINE_PROJETO_SLUG = "projetos-arq";

/** Estágio inicial de um projeto novo. */
export const ESTAGIO_PROJETO_INICIAL: ProjetoEstagioSlug = "briefing";

/** Conjunto de slugs default (validação rápida na app; o pipeline pode ter custom). */
export const SLUGS_PROJETO_PADRAO = new Set<string>(
  ESTAGIOS_PROJETO_PADRAO.map((e) => e.slug)
);

/** Mapa slug → cor (defaults). Custom slugs caem no cinza neutro na UI. */
export const COR_ESTAGIO_PROJETO: Record<string, string> = Object.fromEntries(
  ESTAGIOS_PROJETO_PADRAO.map((e) => [e.slug, e.cor])
);

/**
 * Tipologias sugeridas para o chip Click-and-Go do "Novo projeto".
 * SEM CHECK no banco (campo livre/editável) — isto é só a múltipla escolha da UI.
 */
export const TIPOLOGIAS_PROJETO = [
  { slug: "residencial", label: "Residencial", icone: "🏠" },
  { slug: "corporativo", label: "Corporativo", icone: "🏢" },
  { slug: "interiores",  label: "Interiores",  icone: "🛋️" },
  { slug: "reforma",     label: "Reforma",     icone: "🔨" },
  { slug: "comercial",   label: "Comercial",   icone: "🏬" },
  { slug: "paisagismo",  label: "Paisagismo",  icone: "🌿" },
] as const;

export type TipologiaProjetoSlug = (typeof TIPOLOGIAS_PROJETO)[number]["slug"];

/** Tipologias mostradas por padrão no "Novo projeto" (resto fica em "outras"). */
export const TIPOLOGIAS_PROJETO_PRINCIPAIS: readonly string[] = [
  "residencial",
  "corporativo",
  "interiores",
  "reforma",
];

export function tipologiaLabel(slug: string | null | undefined): string {
  if (!slug) return "";
  return TIPOLOGIAS_PROJETO.find((t) => t.slug === slug)?.label ?? slug;
}

/** Categorias de cômodo do Programa (aba Programa, tipo='comodo'). Editável. */
export const CATEGORIAS_COMODO = [
  { slug: "ambiente", label: "Ambiente" },
  { slug: "servico",  label: "Serviço" },
  { slug: "lazer",    label: "Lazer" },
  { slug: "tecnico",  label: "Técnico" },
] as const;

/** Sugestões rápidas de cômodos para os chips Click-and-Go do Programa. */
export const COMODOS_SUGERIDOS = [
  "Sala", "Suíte", "Quarto", "Cozinha", "Banheiro", "Varanda",
  "Closet", "Escritório", "Lavabo", "Área de serviço", "Garagem",
] as const;

/**
 * Catálogo de cômodos POR CATEGORIA (A1) — alimenta o bottom-sheet/popover do
 * "Adicionar ambiente". É ESCOLHER do catálogo, nunca input livre (Click-and-Go).
 * In-code de propósito (decisão CEO no A1-DESIGN.md: hub_catalogo fica fase 2).
 * Cada item nasce com a `categoria` certa quando vai pro POST lote.
 */
export const CATALOGO_COMODOS: Record<string, readonly string[]> = {
  ambiente: [
    "Sala de estar", "Sala de jantar", "Suíte master", "Suíte", "Quarto",
    "Cozinha", "Banheiro", "Lavabo", "Closet", "Escritório", "Varanda",
    "Hall de entrada", "Sacada",
  ],
  servico: [
    "Área de serviço", "Cozinha gourmet", "Despensa", "Garagem",
    "Depósito", "Lavanderia",
  ],
  lazer: [
    "Varanda gourmet", "Piscina", "Churrasqueira", "Home theater",
    "Espaço fitness", "Jardim", "Deck",
  ],
  tecnico: [
    "Casa de máquinas", "Reservatório", "Quadro elétrico",
    "Shaft", "Ático técnico",
  ],
};

/** Status de aprovação do projeto (eixo separado do funil — o gargalo do arquiteto). */
export const APROVACAO_PROJETO = {
  sem_aprovacao: { label: "Sem envio",   cor: "#94a3b8" },
  aguardando:    { label: "Aguardando",  cor: "#c9a24a" },
  aprovado:      { label: "Aprovado",    cor: "#22c55e" },
  reprovado:     { label: "Reprovado",   cor: "#ef4444" },
} as const;

export type AprovacaoProjetoStatus = keyof typeof APROVACAO_PROJETO;
