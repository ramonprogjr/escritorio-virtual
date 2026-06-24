import { describe, expect, it } from "vitest";
import { FAIXAS_TICKET, valorParaFaixaTicket } from "./smartfield-faixas";

describe("valorParaFaixaTicket — mapeia valor (R$) para faixa de ticket", () => {
  it("classifica nos limites de cada faixa", () => {
    expect(valorParaFaixaTicket(0)).toBe("ate-50k");
    expect(valorParaFaixaTicket(49_999)).toBe("ate-50k");
    expect(valorParaFaixaTicket(50_000)).toBe("50-120k");
    expect(valorParaFaixaTicket(119_999)).toBe("50-120k");
    expect(valorParaFaixaTicket(120_000)).toBe("120-300k");
    expect(valorParaFaixaTicket(299_999)).toBe("120-300k");
    expect(valorParaFaixaTicket(300_000)).toBe("300k+");
    expect(valorParaFaixaTicket(5_000_000)).toBe("300k+");
  });

  it("retorna null para valor ausente/negativo/inválido", () => {
    expect(valorParaFaixaTicket(null)).toBeNull();
    expect(valorParaFaixaTicket(undefined)).toBeNull();
    expect(valorParaFaixaTicket(-1)).toBeNull();
    expect(valorParaFaixaTicket(Number.NaN)).toBeNull();
  });

  it("toda chave retornável existe nas opções de faixa", () => {
    const chaves = new Set(FAIXAS_TICKET.map((f) => f.value));
    for (const v of [0, 50_000, 120_000, 300_000]) {
      expect(chaves.has(valorParaFaixaTicket(v)!)).toBe(true);
    }
  });
});
