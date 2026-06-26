/**
 * fn-derivados — regra de produto: ao ganhar um negócio, ele vira uma ENTREGA na ÁREA certa.
 * Decisão do dono (25/jun): **uma tabela por área** (obra/projeto/marcenaria/marmoraria/
 * vidraçaria/serviço). Mapa mercado→entrega abaixo; mercado sem mapa cai em Obra.
 * Mantido em lib (não na route) para ser testável isoladamente.
 */
export type TipoDerivado =
  | "obra"
  | "projeto"
  | "marcenaria"
  | "marmoraria"
  | "vidracaria"
  | "servico";

export type EntregaConfig = {
  tipo: TipoDerivado;
  tabela: string;
  prefixoCodigo: string;
  statusInicial: string;
  label: string;
};

export const ENTREGA_OBRA: EntregaConfig = {
  tipo: "obra",
  tabela: "hub_obras",
  prefixoCodigo: "OBR",
  statusInicial: "planejamento",
  label: "Obra",
};

/** Mapa mercado (prefixo) → entrega. Uma tabela por área. */
export const ENTREGA_POR_MERCADO: Record<string, EntregaConfig> = {
  ARQ: { tipo: "projeto", tabela: "hub_projetos", prefixoCodigo: "PRJ", statusInicial: "briefing", label: "Projeto" },
  MRC: { tipo: "marcenaria", tabela: "hub_marcenaria", prefixoCodigo: "MRC", statusInicial: "orcamento", label: "Marcenaria" },
  MMR: { tipo: "marmoraria", tabela: "hub_marmoraria", prefixoCodigo: "MMR", statusInicial: "orcamento", label: "Marmoraria" },
  VDR: { tipo: "vidracaria", tabela: "hub_vidracaria", prefixoCodigo: "VDR", statusInicial: "orcamento", label: "Vidraçaria" },
  SRV: { tipo: "servico", tabela: "hub_servicos", prefixoCodigo: "SRV", statusInicial: "agendado", label: "Serviço" },
};

const POR_TIPO: Record<string, EntregaConfig> = Object.fromEntries(
  [ENTREGA_OBRA, ...Object.values(ENTREGA_POR_MERCADO)].map((c) => [c.tipo, c])
);

/** Entrega padrão por mercado (sem override). */
export function entregaPorMercado(prefixo: string | null | undefined): EntregaConfig {
  return ENTREGA_POR_MERCADO[String(prefixo ?? "").trim().toUpperCase()] ?? ENTREGA_OBRA;
}

/** Resolve a entrega final: um override de TIPO válido vence o mercado. */
export function resolverEntrega(
  prefixoMercado: string | null | undefined,
  override?: string | null
): EntregaConfig {
  const o = String(override ?? "").trim().toLowerCase();
  if (o && POR_TIPO[o]) return POR_TIPO[o];
  return entregaPorMercado(prefixoMercado);
}

/** Compat: só o tipo do entregável por mercado. */
export function tipoAlvoPorMercado(prefixo: string | null | undefined): TipoDerivado {
  return entregaPorMercado(prefixo).tipo;
}

/** Compat: só o tipo, com override. */
export function resolverTipoDerivado(
  prefixoMercado: string | null | undefined,
  override?: string | null
): TipoDerivado {
  return resolverEntrega(prefixoMercado, override).tipo;
}
