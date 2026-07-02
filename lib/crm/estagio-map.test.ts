import { describe, expect, it } from "vitest";
import { estagioParaColunaKanban } from "./estagio-map";

/**
 * Regressão do L2/L3 (laudo): leads em slugs de CICLO DE VIDA sumiam do kanban porque as colunas
 * usam slugs de VENDAS. estagioParaColunaKanban tem que devolver SEMPRE uma coluna de vendas.
 */
const COLUNAS_VENDAS = new Set([
  "novo", "qualificando", "qualificado", "proposta",
  "negociando", "fechamento", "ganho", "perdido",
]);

describe("estagioParaColunaKanban — nenhum lead some do board", () => {
  it("traduz slugs de ciclo de vida → coluna de vendas (o bug real)", () => {
    expect(estagioParaColunaKanban("encaminhado")).toBe("proposta");
    expect(estagioParaColunaKanban("aguardando_resposta")).toBe("qualificando");
    expect(estagioParaColunaKanban("em_atendimento")).toBe("negociando");
    expect(estagioParaColunaKanban("convertido_negocio")).toBe("ganho");
    expect(estagioParaColunaKanban("spam_invalido")).toBe("perdido");
  });

  it("mantém slugs que JÁ são coluna de vendas (não colapsa)", () => {
    expect(estagioParaColunaKanban("novo")).toBe("novo");
    expect(estagioParaColunaKanban("qualificado")).toBe("qualificado");
    expect(estagioParaColunaKanban("proposta")).toBe("proposta");
    expect(estagioParaColunaKanban("perdido")).toBe("perdido");
  });

  it("vazio/nulo → 'novo'", () => {
    expect(estagioParaColunaKanban("")).toBe("novo");
    expect(estagioParaColunaKanban(null)).toBe("novo");
    expect(estagioParaColunaKanban(undefined)).toBe("novo");
  });

  it("TODO estagio conhecido cai numa coluna EXISTENTE (nunca some)", () => {
    const todos = [
      "novo", "qualificando", "qualificado", "proposta", "negociando", "fechamento",
      "ganho", "perdido", "encaminhado", "aguardando_resposta", "em_atendimento",
      "convertido_negocio", "spam_invalido",
    ];
    for (const e of todos) {
      expect(COLUNAS_VENDAS.has(estagioParaColunaKanban(e))).toBe(true);
    }
  });
});
