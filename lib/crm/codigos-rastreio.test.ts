import { describe, expect, it } from "vitest";
import { gerarCodigoSequencial, HUB_PREFIXO_CODIGO } from "./codigos-rastreio";

/**
 * Geração de código de rastreio (tipo "CPF", ponta a ponta). Caminho ATUAL = rpc atômica
 * `crm_proximo_codigo` no banco (contador por ano, sem corrida), formato compacto PS2026001 /
 * NGIMB2026001. Fallback degradado (PREFIXO-AAAA-####, COUNT+1) só se a rpc indisponível.
 */
function mockComRpc(retorno: string) {
  return {
    rpc: async () => ({ data: retorno, error: null }),
    from() {
      return { select: async () => ({ count: 0 }) };
    },
  } as unknown as Parameters<typeof gerarCodigoSequencial>[0];
}

function mockFallback(count: number | null) {
  return {
    from() {
      return { select: async () => ({ count }) };
    },
  } as unknown as Parameters<typeof gerarCodigoSequencial>[0];
}

describe("gerarCodigoSequencial — rpc atômica + fallback", () => {
  const year = new Date().getFullYear();

  it("usa a rpc e retorna o código compacto (PS2026001)", async () => {
    const code = await gerarCodigoSequencial(mockComRpc("PS2026001"), "hub_pessoas", HUB_PREFIXO_CODIGO.pessoa);
    expect(code).toBe("PS2026001");
  });

  it("negócio com mercado → rpc retorna NGIMB2026001", async () => {
    const code = await gerarCodigoSequencial(
      mockComRpc("NGIMB2026001"),
      "hub_negocios",
      HUB_PREFIXO_CODIGO.negocio,
      "IMB"
    );
    expect(code).toBe("NGIMB2026001");
  });

  it("fallback degradado (sem rpc) → PREFIXO-AAAA-#### (sistema não quebra)", async () => {
    expect(await gerarCodigoSequencial(mockFallback(7), "hub_pessoas", HUB_PREFIXO_CODIGO.pessoa)).toBe(
      `PES-${year}-0008`
    );
    expect(await gerarCodigoSequencial(mockFallback(null), "hub_negocios", HUB_PREFIXO_CODIGO.negocio)).toBe(
      `NEG-${year}-0001`
    );
  });

  it("mapa de prefixos legado estável (chaves de entidade)", () => {
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
