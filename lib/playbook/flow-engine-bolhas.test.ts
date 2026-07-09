import { describe, expect, it } from "vitest";
import { splitTextIntoBubbles, dividirEmBolhasComLimite } from "./flow-engine";

/** Quebra de bolhas da resposta LLM (QA item 4): 1/3/8 parágrafos + cap. */

describe("splitTextIntoBubbles", () => {
  it("1 parágrafo → 1 bolha", () => {
    expect(splitTextIntoBubbles("Olá, tudo bem?")).toEqual(["Olá, tudo bem?"]);
  });
  it("quebra por linha em branco e ignora vazios", () => {
    expect(splitTextIntoBubbles("um\n\ndois\n\n\n\ntrês")).toEqual(["um", "dois", "três"]);
  });
});

describe("dividirEmBolhasComLimite — usado no envio da resposta LLM", () => {
  it("1 parágrafo → texto CRU (byte-idêntico ao envio único)", () => {
    const t = "Resposta única sem quebras.";
    expect(dividirEmBolhasComLimite(t, 5)).toEqual([t]);
  });
  it("3 parágrafos → 3 bolhas", () => {
    expect(dividirEmBolhasComLimite("a\n\nb\n\nc", 5)).toEqual(["a", "b", "c"]);
  });
  it("8 parágrafos com cap 5 → 4 bolhas + resto concatenado na 5ª", () => {
    const texto = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"].join("\n\n");
    const bolhas = dividirEmBolhasComLimite(texto, 5);
    expect(bolhas).toHaveLength(5);
    expect(bolhas.slice(0, 4)).toEqual(["p1", "p2", "p3", "p4"]);
    expect(bolhas[4]).toBe("p5\n\np6\n\np7\n\np8");
  });
  it("exatamente no limite (5) → 5 bolhas sem concatenar", () => {
    const texto = ["a", "b", "c", "d", "e"].join("\n\n");
    expect(dividirEmBolhasComLimite(texto, 5)).toEqual(["a", "b", "c", "d", "e"]);
  });
});
