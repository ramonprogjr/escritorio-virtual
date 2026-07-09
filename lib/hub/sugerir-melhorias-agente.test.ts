import { describe, expect, it } from "vitest";
import {
  extrairSugestoes,
  combinarComCritico,
  sugestaoCriticaRoteamento,
  type SugestaoMelhoria,
} from "./sugerir-melhorias-agente";

/** Trava as duas lógicas de risco apontadas pelas 2 auditorias Fable-max (09/jul): parse robusto do
 *  LLM e a garantia determinística do aviso crítico (fluxo publicado que não roda). */

const S = (titulo: string, prioridade: SugestaoMelhoria["prioridade"] = "media", extra: Partial<SugestaoMelhoria> = {}): SugestaoMelhoria => ({
  titulo,
  porque: extra.porque ?? "",
  como: extra.como ?? "",
  prioridade,
});

describe("extrairSugestoes (parse robusto)", () => {
  const arr = [
    { titulo: "Melhore a saudação", porque: "está seca", como: "adicione nome", prioridade: "media" },
    { titulo: "Adicione qualificação", porque: "falta", como: "pergunte orçamento", prioridade: "alta" },
  ];

  it("array JSON limpo", () => {
    expect(extrairSugestoes(JSON.stringify(arr))).toHaveLength(2);
  });

  it("dentro de fence ```json```", () => {
    const t = "Claro! Aqui estão:\n```json\n" + JSON.stringify(arr) + "\n```";
    expect(extrairSugestoes(t)).toHaveLength(2);
  });

  it("prosa com '[' ANTES do array (o bug do 1º parse)", () => {
    const t = "Seguem [2] sugestões para o agente: " + JSON.stringify(arr);
    const out = extrairSugestoes(t);
    expect(out).toHaveLength(2);
    expect(out[0].titulo).toBe("Melhore a saudação");
  });

  it("resposta TRUNCADA (sem ']' final) — salvage recupera itens completos", () => {
    const truncado = JSON.stringify(arr).replace(/\]$/, "").replace(/\}$/, "}"); // remove o ] final
    const out = extrairSugestoes(truncado);
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out[0].titulo).toBe("Melhore a saudação");
  });

  it("prioridade inválida vira 'media'; sem titulo é descartado", () => {
    const t = JSON.stringify([{ titulo: "X", prioridade: "urgentíssima" }, { porque: "sem titulo" }]);
    const out = extrairSugestoes(t);
    expect(out).toHaveLength(1);
    expect(out[0].prioridade).toBe("media");
  });

  it("lixo → []", () => {
    expect(extrairSugestoes("desculpe, não consegui")).toEqual([]);
    expect(extrairSugestoes("")).toEqual([]);
  });
});

describe("combinarComCritico (garantia do aviso crítico)", () => {
  const critico = sugestaoCriticaRoteamento();

  it("aviso crítico SEMPRE entra e vem primeiro (alta)", () => {
    const out = combinarComCritico([S("Melhore o tom", "baixa")], critico);
    expect(out[0].titulo).toBe(critico.titulo);
    expect(out[0].prioridade).toBe("alta");
  });

  it("menção GENÉRICA a WhatsApp NÃO suprime o crítico (o bug do 2º audit)", () => {
    const out = combinarComCritico(
      [S("Melhore a saudação do fluxo de WhatsApp", "media", { como: "use o nome no WhatsApp" })],
      critico
    );
    expect(out.some((s) => s.titulo === critico.titulo)).toBe(true);
  });

  it("menção ESPECÍFICA a fluxo que não roda SUPRIME o crítico (dedup)", () => {
    const out = combinarComCritico(
      [S("Roteamento inativo", "alta", { porque: "o fluxo não roda no WhatsApp" })],
      critico
    );
    expect(out.filter((s) => s.titulo === critico.titulo)).toHaveLength(0);
  });

  it("crítico sobrevive a parse falho (parseadas vazias) — não vira 'sem sugestões'", () => {
    const out = combinarComCritico([], critico);
    expect(out).toHaveLength(1);
    expect(out[0].titulo).toBe(critico.titulo);
  });

  it("sem crítico: só ordena por prioridade e corta em 7", () => {
    const muitas = [S("a", "baixa"), S("b", "alta"), S("c", "media")];
    const out = combinarComCritico(muitas, null);
    expect(out.map((s) => s.prioridade)).toEqual(["alta", "media", "baixa"]);
  });

  it("ambos vazios → []", () => {
    expect(combinarComCritico([], null)).toEqual([]);
  });
});
