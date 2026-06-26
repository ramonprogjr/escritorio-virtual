export type PrecoModelo = { inputUsdMilhao: number; outputUsdMilhao: number };

/** Preços de referência (USD por 1M tokens, jun/2026). Provider-agnostic. */
export const PRECOS_MODELOS: Record<string, PrecoModelo> = {
  "claude-opus-4-8": { inputUsdMilhao: 5, outputUsdMilhao: 25 },
  "claude-sonnet-4-6": { inputUsdMilhao: 3, outputUsdMilhao: 15 },
  "claude-haiku-4-5": { inputUsdMilhao: 1, outputUsdMilhao: 5 },
  "claude-fable-5": { inputUsdMilhao: 10, outputUsdMilhao: 50 },
  "mistral-large-latest": { inputUsdMilhao: 2, outputUsdMilhao: 6 },
  "mistral-small-latest": { inputUsdMilhao: 0.2, outputUsdMilhao: 0.6 },
};

/** Fallback conservador: modelo desconhecido nunca é sub-cobrado. */
export const PRECO_DEFAULT: PrecoModelo = { inputUsdMilhao: 10, outputUsdMilhao: 50 };

export function precoDoModelo(
  modelo: string,
  tabela: Record<string, PrecoModelo> = PRECOS_MODELOS,
): PrecoModelo {
  return tabela[modelo] ?? PRECO_DEFAULT;
}

export function custoUsdDeTokens(p: {
  modelo: string;
  tokensEntrada: number;
  tokensSaida: number;
  tabela?: Record<string, PrecoModelo>;
}): number {
  const preco = precoDoModelo(p.modelo, p.tabela);
  return (p.tokensEntrada * preco.inputUsdMilhao + p.tokensSaida * preco.outputUsdMilhao) / 1_000_000;
}

export function custoBrl(custoUsd: number, fxUsdBrl: number, markup: number): number {
  return custoUsd * fxUsdBrl * markup;
}

/** Tijolos cobrados = custo (R$) ÷ valor do Tijolo, arredondado pra cima. */
export function creditosDeCusto(custoBrl: number, valorCreditoBrl: number): number {
  if (valorCreditoBrl <= 0 || custoBrl <= 0) return 0;
  return Math.ceil(custoBrl / valorCreditoBrl);
}
