import { describe, it, expect } from "vitest";
import {
  precoDoModelo,
  custoUsdDeTokens,
  custoBrl,
  creditosDeCusto,
  PRECO_DEFAULT,
} from "./metering-calc";

describe("metering-calc", () => {
  it("precoDoModelo retorna preço do modelo conhecido", () => {
    expect(precoDoModelo("claude-opus-4-8")).toEqual({ inputUsdMilhao: 5, outputUsdMilhao: 25 });
  });

  it("precoDoModelo cai no fallback conservador p/ modelo desconhecido", () => {
    expect(precoDoModelo("modelo-inexistente")).toEqual(PRECO_DEFAULT);
  });

  it("custoUsdDeTokens calcula (in*preçoIn + out*preçoOut)/1e6", () => {
    // opus: 1000 in * 5 + 500 out * 25 = 5000 + 12500 = 17500 / 1e6 = 0.0175
    const usd = custoUsdDeTokens({ modelo: "claude-opus-4-8", tokensEntrada: 1000, tokensSaida: 500 });
    expect(usd).toBeCloseTo(0.0175, 6);
  });

  it("custoBrl aplica câmbio e markup", () => {
    expect(custoBrl(0.0175, 6, 10)).toBeCloseTo(1.05, 6); // 0.0175 * 6 * 10
  });

  it("creditosDeCusto arredonda PRA CIMA pelo valor do crédito", () => {
    expect(creditosDeCusto(1.05, 0.1)).toBe(11); // ceil(10.5)
  });

  it("creditosDeCusto é 0 quando custo é 0", () => {
    expect(creditosDeCusto(0, 0.1)).toBe(0);
  });
});
