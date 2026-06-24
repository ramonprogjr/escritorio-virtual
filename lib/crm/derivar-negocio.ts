/**
 * fn-derivados — regra de produto: ao ganhar um negócio, ele vira Obra ou Projeto.
 * Decisão por mercado (ARQ/MRC → projeto; demais → obra), com override explícito.
 * Mantido em lib (não na route) para ser testável isoladamente.
 */
export type TipoDerivado = "obra" | "projeto";

/** Mercados cujo entregável padrão é um Projeto (design), não uma Obra (execução). */
export const MERCADOS_PROJETO = new Set(["ARQ", "MRC"]);

export function tipoAlvoPorMercado(prefixo: string | null | undefined): TipoDerivado {
  return MERCADOS_PROJETO.has(String(prefixo ?? "").toUpperCase()) ? "projeto" : "obra";
}

/** Resolve o tipo final: override válido vence o mercado. */
export function resolverTipoDerivado(
  prefixoMercado: string | null | undefined,
  override?: string | null
): TipoDerivado {
  const o = String(override ?? "").toLowerCase();
  if (o === "obra" || o === "projeto") return o;
  return tipoAlvoPorMercado(prefixoMercado);
}
