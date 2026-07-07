import { describe, expect, it } from "vitest";
import { ehRegistroDeTeste } from "./dashboard-aggregate";

describe("ehRegistroDeTeste — vitrine da home sem dado de teste", () => {
  it("oculta nomes que começam com TESTE (case-insensitive)", () => {
    expect(ehRegistroDeTeste("TESTE ARIANE")).toBe(true);
    expect(ehRegistroDeTeste("teste fabio")).toBe(true);
    expect(ehRegistroDeTeste("  Teste com espaço")).toBe(true);
  });

  it("oculta rótulos [TESTE] e qualquer AUDITORIA", () => {
    expect(ehRegistroDeTeste("[TESTE] lead")).toBe(true);
    expect(ehRegistroDeTeste("Lead de AUDITORIA")).toBe(true);
    expect(ehRegistroDeTeste("auditoria interna")).toBe(true);
  });

  it("mantém leads reais (não é registro de teste)", () => {
    expect(ehRegistroDeTeste("Fabio Souza")).toBe(false);
    expect(ehRegistroDeTeste("Studio Áurea Arquitetura")).toBe(false);
    expect(ehRegistroDeTeste("Construtora Atestado")).toBe(false); // contém "teste" no meio, não no início
  });

  it("trata nome vazio/nulo como não-teste", () => {
    expect(ehRegistroDeTeste(null)).toBe(false);
    expect(ehRegistroDeTeste(undefined)).toBe(false);
    expect(ehRegistroDeTeste("")).toBe(false);
  });
});
