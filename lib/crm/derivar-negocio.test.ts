import { describe, expect, it } from "vitest";
import { resolverTipoDerivado, tipoAlvoPorMercado, resolverEntrega } from "./derivar-negocio";

describe("fn-derivados: entrega por mercado (uma tabela por área)", () => {
  it("cada mercado vira sua entrega na área certa", () => {
    expect(tipoAlvoPorMercado("ARQ")).toBe("projeto");
    expect(tipoAlvoPorMercado("MRC")).toBe("marcenaria");
    expect(tipoAlvoPorMercado("MMR")).toBe("marmoraria");
    expect(tipoAlvoPorMercado("VDR")).toBe("vidracaria");
    expect(tipoAlvoPorMercado("SRV")).toBe("servico");
    expect(tipoAlvoPorMercado("arq")).toBe("projeto"); // case-insensitive
  });

  it("mercados sem mapa viram obra (default)", () => {
    for (const m of ["RFM", "ENG", "IMB", "PRO", "FOR"]) {
      expect(tipoAlvoPorMercado(m)).toBe("obra");
    }
  });

  it("mercado nulo/desconhecido cai em obra (default seguro)", () => {
    expect(tipoAlvoPorMercado(null)).toBe("obra");
    expect(tipoAlvoPorMercado(undefined)).toBe("obra");
    expect(tipoAlvoPorMercado("XYZ")).toBe("obra");
  });

  it("resolverEntrega devolve a tabela/prefixo/status corretos", () => {
    expect(resolverEntrega("MRC").tabela).toBe("hub_marcenaria");
    expect(resolverEntrega("MRC").prefixoCodigo).toBe("MRC");
    expect(resolverEntrega("VDR").tabela).toBe("hub_vidracaria");
    expect(resolverEntrega("ZZZ").tabela).toBe("hub_obras"); // default
  });

  it("override de tipo válido vence o mercado", () => {
    expect(resolverTipoDerivado("ARQ", "obra")).toBe("obra"); // projeto por mercado, mas override obra
    expect(resolverTipoDerivado("RFM", "projeto")).toBe("projeto"); // obra por mercado, mas override projeto
    expect(resolverTipoDerivado("ARQ", "Obra")).toBe("obra"); // case-insensitive
    expect(resolverTipoDerivado("RFM", "marcenaria")).toBe("marcenaria");
  });

  it("override inválido é ignorado (cai na regra de mercado)", () => {
    expect(resolverTipoDerivado("ARQ", "banana")).toBe("projeto");
    expect(resolverTipoDerivado("RFM", "")).toBe("obra");
    expect(resolverTipoDerivado("MRC", null)).toBe("marcenaria");
  });
});
