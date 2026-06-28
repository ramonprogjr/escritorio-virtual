import { describe, expect, it } from "vitest";
import { parceiroParaFornecedor } from "./parceiro-fornecedor-map";

describe("parceiroParaFornecedor — contrato puro parceiro → fornecedor", () => {
  describe("mercado (string singular) → mercados[] + mercado_principal", () => {
    it("mercado preenchido vira array de 1 + principal", () => {
      const r = parceiroParaFornecedor({ mercado: "IMB", status: "homologado" });
      expect(r.mercados).toEqual(["IMB"]);
      expect(r.mercado_principal).toBe("IMB");
    });

    it("mercado com espaços é normalizado (trim)", () => {
      const r = parceiroParaFornecedor({ mercado: "  ARQ  ", status: "homologado" });
      expect(r.mercados).toEqual(["ARQ"]);
      expect(r.mercado_principal).toBe("ARQ");
    });

    it("mercado vazio/null/undefined → array vazio + principal null", () => {
      expect(parceiroParaFornecedor({ mercado: "", status: "homologado" }).mercados).toEqual([]);
      expect(parceiroParaFornecedor({ mercado: null, status: "homologado" }).mercado_principal).toBeNull();
      expect(parceiroParaFornecedor({ status: "homologado" }).mercados).toEqual([]);
    });
  });

  describe("status → { status_acesso, status } (menor privilégio)", () => {
    // Tabela de mapeamento — entrada → status_acesso esperado + status preservado.
    const tabela: Array<{
      entrada: string | null | undefined;
      acesso: "aprovado" | "pendente";
      status: "captacao" | "em_homologacao" | "homologado";
    }> = [
      { entrada: "homologado", acesso: "aprovado", status: "homologado" },
      { entrada: "em_homologacao", acesso: "pendente", status: "em_homologacao" },
      { entrada: "captacao", acesso: "pendente", status: "captacao" },
      // Desconhecidos / legados → menor privilégio (NUNCA aprovado).
      { entrada: "inativo", acesso: "pendente", status: "captacao" },
      { entrada: "rejeitado", acesso: "pendente", status: "captacao" },
      { entrada: "qualquer_coisa", acesso: "pendente", status: "captacao" },
      { entrada: "", acesso: "pendente", status: "captacao" },
      { entrada: null, acesso: "pendente", status: "captacao" },
      { entrada: undefined, acesso: "pendente", status: "captacao" },
    ];

    it.each(tabela)(
      "status=$entrada → acesso=$acesso, status=$status",
      ({ entrada, acesso, status }) => {
        const r = parceiroParaFornecedor({ mercado: "IMB", status: entrada });
        expect(r.status_acesso).toBe(acesso);
        expect(r.status).toBe(status);
      }
    );

    it("aceita status com caixa/espaços diferentes (case-insensitive + trim)", () => {
      expect(parceiroParaFornecedor({ status: " Homologado " }).status_acesso).toBe("aprovado");
      expect(parceiroParaFornecedor({ status: "EM_HOMOLOGACAO" }).status_acesso).toBe("pendente");
    });

    it("SEGURANÇA: só 'homologado' produz acesso aprovado", () => {
      const entradas = ["captacao", "em_homologacao", "inativo", "rejeitado", "", null, undefined];
      for (const e of entradas) {
        expect(parceiroParaFornecedor({ status: e }).status_acesso).toBe("pendente");
      }
    });
  });

  it("shape completo de um parceiro homologado com mercado", () => {
    expect(parceiroParaFornecedor({ mercado: "ENG", status: "homologado" })).toEqual({
      mercados: ["ENG"],
      mercado_principal: "ENG",
      status_acesso: "aprovado",
      status: "homologado",
    });
  });
});
