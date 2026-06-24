import { describe, expect, it } from "vitest";
import { resolverTipoDerivado, tipoAlvoPorMercado } from "./derivar-negocio";

describe("fn-derivados: regra obra vs projeto por mercado", () => {
  it("ARQ e MRC viram projeto", () => {
    expect(tipoAlvoPorMercado("ARQ")).toBe("projeto");
    expect(tipoAlvoPorMercado("MRC")).toBe("projeto");
    expect(tipoAlvoPorMercado("arq")).toBe("projeto"); // case-insensitive
  });

  it("demais mercados viram obra", () => {
    for (const m of ["RFM", "ENG", "IMB", "SRV", "PRO", "FOR"]) {
      expect(tipoAlvoPorMercado(m)).toBe("obra");
    }
  });

  it("mercado nulo/desconhecido cai em obra (default seguro)", () => {
    expect(tipoAlvoPorMercado(null)).toBe("obra");
    expect(tipoAlvoPorMercado(undefined)).toBe("obra");
    expect(tipoAlvoPorMercado("XYZ")).toBe("obra");
  });

  it("override válido vence o mercado", () => {
    expect(resolverTipoDerivado("ARQ", "obra")).toBe("obra"); // projeto por mercado, mas override obra
    expect(resolverTipoDerivado("RFM", "projeto")).toBe("projeto"); // obra por mercado, mas override projeto
    expect(resolverTipoDerivado("ARQ", "Obra")).toBe("obra"); // case-insensitive
  });

  it("override inválido é ignorado (cai na regra de mercado)", () => {
    expect(resolverTipoDerivado("ARQ", "banana")).toBe("projeto");
    expect(resolverTipoDerivado("RFM", "")).toBe("obra");
    expect(resolverTipoDerivado("MRC", null)).toBe("projeto");
  });
});
