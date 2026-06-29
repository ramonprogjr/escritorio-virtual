import { describe, it, expect } from "vitest";
import {
  personaDaSessao,
  sessaoPodeEscreverCusto,
  sessaoPodeVerMargem,
} from "./persona-escopo";

/**
 * Bloqueador 2/3 da auditoria: a persona de escopo vem do PAPEL da sessão (server-side), não do
 * cliente. O default seguro é o MAIS restrito (prestador) — nunca "executor" por omissão.
 */
describe("persona-escopo — mapeamento role → persona (server-side)", () => {
  it("owner e gestor (admin/auditor) → hub (vê custo+preço+margem)", () => {
    expect(personaDaSessao("owner")).toBe("hub");
    expect(personaDaSessao("gestor")).toBe("hub");
    expect(personaDaSessao("admin")).toBe("hub"); // legado → gestor → hub
  });

  it("comercial/financeiro/atendente (equipe da obra) → executor", () => {
    expect(personaDaSessao("comercial")).toBe("executor");
    expect(personaDaSessao("financeiro")).toBe("executor");
    expect(personaDaSessao("atendente")).toBe("executor");
    expect(personaDaSessao("vendedor")).toBe("executor"); // legado → comercial → executor
  });

  it("parceiro (prestador externo) → prestador (só preço)", () => {
    expect(personaDaSessao("parceiro")).toBe("prestador");
  });

  it("DEFAULT SEGURO: role desconhecido/vazio/null → prestador (o mais restrito), nunca executor", () => {
    expect(personaDaSessao("")).toBe("prestador");
    expect(personaDaSessao(null)).toBe("prestador");
    expect(personaDaSessao(undefined)).toBe("prestador");
    expect(personaDaSessao("papel_que_nao_existe")).toBe("prestador");
  });
});

describe("persona-escopo — gates de escrita/leitura derivados do papel", () => {
  it("sessaoPodeEscreverCusto: só hub|executor; prestador e desconhecido NÃO", () => {
    expect(sessaoPodeEscreverCusto("owner")).toBe(true);
    expect(sessaoPodeEscreverCusto("gestor")).toBe(true);
    expect(sessaoPodeEscreverCusto("comercial")).toBe(true);
    expect(sessaoPodeEscreverCusto("financeiro")).toBe(true);
    expect(sessaoPodeEscreverCusto("parceiro")).toBe(false);
    expect(sessaoPodeEscreverCusto("")).toBe(false); // default seguro não vaza escrita de custo
  });

  it("sessaoPodeVerMargem: prestador nunca; hub|executor sim", () => {
    expect(sessaoPodeVerMargem("owner")).toBe(true);
    expect(sessaoPodeVerMargem("comercial")).toBe(true);
    expect(sessaoPodeVerMargem("parceiro")).toBe(false);
    expect(sessaoPodeVerMargem(null)).toBe(false);
  });
});
