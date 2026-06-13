/**
 * Triagem Mari — somente Arquitetura e Imobiliário (Obra10+).
 * Formato UAZAPI: «Rótulo|id» ou listas com descrição «Rótulo|id|descrição».
 */

/** Triagem em botões (4 opções — abaixo do limite de lista). */
export const MARI_TRIAGEM_ARQ_IMOB_UAZAPI = [
  "[O que você precisa hoje?]",
  "Arquitetura e projetos|fluxo_arquitetura|Projeto, interiores ou design",
  "Obra / reforma|fluxo_arquitetura_obra|Construção ou reforma com projeto",
  "Comprar ou alugar imóvel|fluxo1|Cliente no mercado imobiliário",
  "Vender ou anunciar imóvel|fluxo2|Proprietário — venda ou locação",
] as const;

/** Linhas para instruções ao modelo (sem cabeçalho de secção). */
export const MARI_TRIAGEM_ARQ_IMOB_LINHAS_PROMPT = [
  "Arquitetura e projetos|fluxo_arquitetura",
  "Obra / reforma|fluxo_arquitetura_obra",
  "Comprar ou alugar imóvel|fluxo1",
  "Vender ou anunciar imóvel|fluxo2",
] as const;

/** @deprecated Use MARI_TRIAGEM_ARQ_IMOB_LINHAS_PROMPT */
export const MARI_TRIAGEM_5_LINHAS_PROMPT = MARI_TRIAGEM_ARQ_IMOB_LINHAS_PROMPT;

export function formatarOpcoesTriagemParaPrompt(): string {
  return MARI_TRIAGEM_ARQ_IMOB_LINHAS_PROMPT.map((o) => `- ${o}`).join("\n");
}
