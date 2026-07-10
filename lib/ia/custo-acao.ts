/**
 * Consumo de IA nas telas — REGRA DA CASA (decisão do dono, 09/jul):
 *
 *  1. TOKEN e REAL (R$) NUNCA aparecem na interface. A conversão token→Tijolo→Bloco é opaca de
 *     propósito (margem interna). O único lugar onde o gasto aparece é a ÁREA DE RELATÓRIO
 *     (Carteira de Tijolos em /crm/creditos e a central do copiloto em /crm/agentes-reais).
 *  2. ANTES de uma ação que consome MUITO, o usuário é avisado e confirma. Ações leves (o copiloto
 *     do dia a dia) não param o fluxo com pergunta.
 *
 * Este módulo é PURO (sem I/O) e só define quais ações são pesadas e como falar do consumo delas
 * sem inventar número: se não houver histórico daquela ação, dizemos que não sabemos.
 */

/** Uma ação pesada: `origem` é a chave gravada em hub_ia_consumo pelo endpoint que a executa. */
export type AcaoIaPesada = {
  /** valor de `origem` em hub_ia_consumo (fonte da média real). */
  origem: string;
  /** título do aviso, em linguagem de dono. */
  rotulo: string;
  /** o que a ação vai fazer, para a pessoa decidir com consciência. */
  oQueFaz: string;
};

/**
 * Ações que valem um aviso antes de rodar: cada uma dispara UMA chamada grande ao modelo (documento
 * inteiro, playbook inteiro, agente inteiro). As origens vêm dos endpoints reais que as registram.
 */
export const ACOES_IA_PESADAS: Record<string, AcaoIaPesada> = {
  blueprint_agente: {
    origem: "blueprint_agente_ia",
    rotulo: "Criar o agente com IA",
    oQueFaz: "A IA vai ler a sua descrição inteira e montar o agente (cargo, ferramentas, instruções).",
  },
  sugestoes_melhoria: {
    origem: "sugestoes_melhoria_agente",
    rotulo: "Analisar e sugerir melhorias",
    oQueFaz: "A IA vai ler o agente inteiro e o histórico dele para sugerir o que melhorar.",
  },
  playbook_por_ia: {
    origem: "playbook_builder_ia",
    rotulo: "Montar o fluxo com IA",
    oQueFaz: "A IA vai montar o fluxo de conversa do agente do zero.",
  },
  analisar_documento: {
    origem: "playbook_analisar_conteudo",
    rotulo: "Analisar o documento",
    oQueFaz: "A IA vai ler o documento inteiro e transformá-lo em conhecimento do agente.",
  },
};

export function acaoIaPesada(id: string): AcaoIaPesada | null {
  return ACOES_IA_PESADAS[id] ?? null;
}

/**
 * Frase honesta sobre o consumo, a partir do histórico REAL daquela ação neste escritório.
 * Sem histórico não inventamos estimativa — dizemos que ainda não sabemos.
 * Nunca menciona token nem R$.
 */
export function textoConsumoEstimado(mediaTijolos: number | null, amostras: number): string {
  if (!amostras || mediaTijolos == null || !Number.isFinite(mediaTijolos) || mediaTijolos <= 0) {
    return "Esta é a primeira vez — ainda não sabemos quanto ela costuma consumir.";
  }
  const media = Math.max(1, Math.round(mediaTijolos));
  const vezes = amostras === 1 ? "1 vez" : `${amostras} vezes`;
  return `Costuma consumir cerca de ${media} ${media === 1 ? "Tijolo" : "Tijolos"} (média de ${vezes}).`;
}

/** O saldo cobre o consumo esperado? Sem histórico, só barra se o saldo estiver zerado. */
export function saldoSuficiente(saldo: number, mediaTijolos: number | null): boolean {
  const s = Number.isFinite(saldo) ? saldo : 0;
  if (s <= 0) return false;
  if (mediaTijolos == null || !Number.isFinite(mediaTijolos) || mediaTijolos <= 0) return true;
  return s >= Math.round(mediaTijolos);
}
