import { describe, expect, it } from "vitest";
import { shouldHideCrmUniversalHeader } from "@/lib/crm-universal-header-visibility";

// Lógica pura por trás do CrmUniversalHeader (usado em ~18 telas). Se quebrar,
// telas de detalhe empilham dois cabeçalhos OU o header some das listas —
// regressão de "quebrou outra tela" que o compilador não pega. Node, sem mock.

describe("shouldHideCrmUniversalHeader", () => {
  it("mostra o header universal nas telas de LISTA (não esconde)", () => {
    for (const p of ["/crm", "/crm/leads", "/crm/negocios", "/crm/parceiros", "/crm/agentes", "/crm/pessoas"]) {
      expect(shouldHideCrmUniversalHeader(p)).toBe(false);
    }
  });

  it("esconde nas telas de DETALHE de lead (faixa própria)", () => {
    expect(shouldHideCrmUniversalHeader("/crm/leads/123")).toBe(true);
    expect(shouldHideCrmUniversalHeader("/crm/lead/123")).toBe(true);
  });

  it("esconde no detalhe de parceiro/agente, MAS não na rota 'novo'", () => {
    expect(shouldHideCrmUniversalHeader("/crm/parceiros/abc")).toBe(true);
    expect(shouldHideCrmUniversalHeader("/crm/parceiros/novo")).toBe(false);
    expect(shouldHideCrmUniversalHeader("/crm/agentes/algum-slug")).toBe(true);
    expect(shouldHideCrmUniversalHeader("/crm/agentes/novo")).toBe(false);
  });

  it("não esconde em detalhe de negócio (usa o header universal)", () => {
    expect(shouldHideCrmUniversalHeader("/crm/negocios/123")).toBe(false);
  });
});
