import { describe, expect, it } from "vitest";
import { ACOES_IA_PESADAS, acaoIaPesada, textoConsumoEstimado, saldoSuficiente } from "./custo-acao";

describe("consumo de IA nas telas — regra do dono", () => {
  it("nenhum texto da lib menciona token ou R$ (conversão opaca)", () => {
    const textos = Object.values(ACOES_IA_PESADAS).flatMap((a) => [a.rotulo, a.oQueFaz]);
    textos.push(textoConsumoEstimado(12, 5), textoConsumoEstimado(null, 0));
    for (const t of textos) {
      expect(t).not.toMatch(/token|R\$|tok\b/i);
    }
  });

  it("sem histórico: diz honestamente que não sabe — nunca inventa estimativa", () => {
    expect(textoConsumoEstimado(null, 0)).toMatch(/primeira vez/i);
    expect(textoConsumoEstimado(0, 0)).toMatch(/primeira vez/i);
    expect(textoConsumoEstimado(5, 0)).toMatch(/primeira vez/i); // média sem amostra não vale
  });

  it("com histórico: usa a média real e o nº de amostras", () => {
    expect(textoConsumoEstimado(1, 1)).toBe("Costuma consumir cerca de 1 Tijolo (média de 1 vez).");
    expect(textoConsumoEstimado(12.4, 5)).toBe("Costuma consumir cerca de 12 Tijolos (média de 5 vezes).");
  });

  it("saldo: barra quando zerado; sem média, só o zero barra", () => {
    expect(saldoSuficiente(0, 10)).toBe(false);
    expect(saldoSuficiente(0, null)).toBe(false);
    expect(saldoSuficiente(5, null)).toBe(true); // consumo desconhecido, tem saldo → deixa rodar
    expect(saldoSuficiente(5, 10)).toBe(false); // média maior que o saldo → barra
    expect(saldoSuficiente(10, 10)).toBe(true);
  });

  it("acaoIaPesada só reconhece as ações mapeadas", () => {
    expect(acaoIaPesada("blueprint_agente")?.origem).toBe("blueprint_agente_ia");
    expect(acaoIaPesada("sugestoes_melhoria")?.origem).toBe("sugestoes_melhoria_agente");
    expect(acaoIaPesada("copiloto_do_dia_a_dia")).toBeNull(); // ação leve não pede confirmação
  });
});
