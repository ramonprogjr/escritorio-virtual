import { describe, expect, it } from "vitest";
import { gerarCodigoSequencial, HUB_PREFIXO_CODIGO } from "./codigos-rastreio";

/**
 * Mock mínimo do SupabaseClient: só o caminho .from(tabela).select(..., {count, head}).
 * Documenta o contrato atual. NB: a geração usa COUNT(*)+1 (risco de corrida sob concorrência
 * e formato PREFIXO-AAAA-#### — diverge do `PS2026001` do doc mestre). Correção real = sequence/
 * trigger no banco (Bloco integridade, via MCP). Estes testes travam o comportamento vigente.
 */
function mockSupabase(count: number | null) {
  return {
    from() {
      return {
        select: async () => ({ count }),
      };
    },
  } as unknown as Parameters<typeof gerarCodigoSequencial>[0];
}

describe("gerarCodigoSequencial — formato PREFIXO-AAAA-####", () => {
  const year = new Date().getFullYear();

  it("incrementa a partir do count atual, com padding 4 dígitos", async () => {
    const code = await gerarCodigoSequencial(mockSupabase(7), "hub_pessoas", HUB_PREFIXO_CODIGO.pessoa);
    expect(code).toBe(`PES-${year}-0008`);
  });

  it("count 0 → 0001", async () => {
    expect(await gerarCodigoSequencial(mockSupabase(0), "hub_leads_crm", HUB_PREFIXO_CODIGO.lead)).toBe(
      `LED-${year}-0001`
    );
  });

  it("count null → 0001 (tabela vazia / sem count)", async () => {
    expect(await gerarCodigoSequencial(mockSupabase(null), "hub_negocios", HUB_PREFIXO_CODIGO.negocio)).toBe(
      `NEG-${year}-0001`
    );
  });

  it("acima de 9999 não trunca (padStart só preenche)", async () => {
    expect(await gerarCodigoSequencial(mockSupabase(9999), "hub_imoveis", HUB_PREFIXO_CODIGO.imovel)).toBe(
      `IMO-${year}-10000`
    );
  });

  it("mapa de prefixos estável (rastreio ponta a ponta)", () => {
    expect(HUB_PREFIXO_CODIGO).toEqual({
      pessoa: "PES",
      empresa: "EMP",
      lead: "LED",
      negocio: "NEG",
      parceiro: "PAR",
      imovel: "IMO",
    });
  });
});
