import { describe, expect, it } from "vitest";
import { formatarCardWhatsApp, telefoneWa, rotuloMercado, type CardResumoLead } from "./gerar-card-lead";

/** Testes das partes PURAS do card (QA item 4): telefoneWa, rótulo, formatação WhatsApp + defensivo. */

function cardBase(over: Partial<CardResumoLead> = {}): CardResumoLead {
  return {
    nome: "Maria Silva",
    telefone: "(11) 98888-7777",
    telefone_wa: "5511988887777",
    email: "maria@ex.com",
    cidade: "São Paulo",
    estado: "SP",
    mercado: "ARQ",
    codigo: "LED-0231",
    valor_estimado: 40000,
    interesse_principal: "cobertura retrátil",
    pedido_resumo: "Cliente quer cobertura retrátil ~40m².",
    pontos: ["Orçamento estimado: R$ 40.000", "Local: São Paulo/SP"],
    ultimas_falas: [{ de: "cliente", texto: "consegue passar um valor?", em: null }],
    fonte_resumo: "ia",
    gerado_em: "2026-07-09T00:00:00.000Z",
    ...over,
  };
}

describe("telefoneWa — dígitos internacionais p/ wa.me", () => {
  it("celular BR 11 dígitos ganha 55", () => {
    expect(telefoneWa("11988887777")).toBe("5511988887777");
  });
  it("fixo BR 10 dígitos ganha 55", () => {
    expect(telefoneWa("1133334444")).toBe("551133334444");
  });
  it("já com DDI (12/13) não muda", () => {
    expect(telefoneWa("551133334444")).toBe("551133334444");
    expect(telefoneWa("5511988887777")).toBe("5511988887777");
  });
  it("máscara é ignorada (só dígitos)", () => {
    expect(telefoneWa("(11) 98888-7777")).toBe("5511988887777");
  });
  it("curto/ausente → null", () => {
    expect(telefoneWa("123")).toBeNull();
    expect(telefoneWa("")).toBeNull();
    expect(telefoneWa(null)).toBeNull();
  });
});

describe("rotuloMercado — código interno vira rótulo humano", () => {
  it("ARQ → Arquitetura, IMB → Imóveis", () => {
    expect(rotuloMercado("ARQ")).toBe("Arquitetura");
    expect(rotuloMercado("IMB")).toBe("Imóveis");
  });
  it("desconhecido devolve como veio", () => {
    expect(rotuloMercado("XPTO")).toBe("XPTO");
  });
});

describe("formatarCardWhatsApp — texto rico click-and-go", () => {
  it("inclui nome+código, pedido, última fala, wa.me e link do painel", () => {
    const txt = formatarCardWhatsApp(cardBase(), { encaminhamentoId: "enc-1", appUrl: "https://app.obra10.com/" });
    expect(txt).toContain("Maria Silva (LED-0231)");
    expect(txt).toContain("📋 *Pedido:* Cliente quer cobertura retrátil ~40m².");
    expect(txt).toContain('💬 *Última fala:* "consegue passar um valor?"');
    expect(txt).toContain("https://wa.me/5511988887777");
    expect(txt).toContain("https://app.obra10.com/parceiro/dashboard?enc=enc-1");
    expect(txt).toContain("*Mercado:* Arquitetura"); // rótulo humano, não "ARQ"
  });

  it("não menciona 'citado' (o valor é ESTIMADO do CRM — QA B2)", () => {
    const txt = formatarCardWhatsApp(cardBase(), { appUrl: "https://x" });
    expect(txt).not.toMatch(/citado/i);
    expect(txt).toContain("Orçamento estimado");
  });

  it("sem encaminhamentoId → link do painel sem query", () => {
    const txt = formatarCardWhatsApp(cardBase(), { appUrl: "https://x/" });
    expect(txt).toContain("https://x/parceiro/dashboard");
    expect(txt).not.toContain("?enc=");
  });

  it("DEFENSIVO (QA B1): card malformado com pontos/ultimas_falas não-array NÃO lança", () => {
    const ruim = {
      ...cardBase(),
      pontos: undefined as unknown as string[],
      ultimas_falas: null as unknown as CardResumoLead["ultimas_falas"],
    };
    expect(() => formatarCardWhatsApp(ruim, { appUrl: "https://x" })).not.toThrow();
    const txt = formatarCardWhatsApp(ruim, { appUrl: "https://x" });
    expect(txt).toContain("📋 *Pedido:*");
  });

  it("email do lead NÃO vaza no texto ao parceiro", () => {
    const txt = formatarCardWhatsApp(cardBase(), { appUrl: "https://x" });
    expect(txt).not.toContain("maria@ex.com");
  });
});
