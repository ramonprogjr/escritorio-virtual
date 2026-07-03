import { describe, it, expect } from "vitest";
import { sanitizarBuscaNome, BUSCA_NOME_MIN } from "@/lib/crm/rastreio-busca";

describe("sanitizarBuscaNome", () => {
  it("mantém nomes simples e apara espaços", () => {
    expect(sanitizarBuscaNome("  Wendel Cruz  ")).toBe("Wendel Cruz");
    expect(sanitizarBuscaNome("Nice Engenharia")).toBe("Nice Engenharia");
  });

  it("remove curingas do ILIKE e separadores do PostgREST (.or / injeção)", () => {
    // % _ \ viram espaço → sem curinga controlado pelo usuário
    expect(sanitizarBuscaNome("a%b_c\\d")).toBe("a b c d");
    // , ( ) * quebrariam o parser do .or → viram espaço
    expect(sanitizarBuscaNome("nome.ilike.x,razao.ilike.(*)")).toBe("nome.ilike.x razao.ilike.");
  });

  it("colapsa espaços múltiplos gerados pela remoção", () => {
    expect(sanitizarBuscaNome("a,,,b")).toBe("a b");
  });

  it("texto curto demais (após sanear) fica abaixo do mínimo", () => {
    expect(sanitizarBuscaNome("%").length).toBeLessThan(BUSCA_NOME_MIN);
    expect(sanitizarBuscaNome(" a ").length).toBeLessThan(BUSCA_NOME_MIN);
  });
});
