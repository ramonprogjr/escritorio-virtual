import { describe, expect, it } from "vitest";
import { validarBlueprint } from "./agente-blueprint";

const CARGOS = ["sdr-imobiliario", "copiloto-interno"];

describe("validarBlueprint — saneia o blueprint da IA contra os catálogos reais", () => {
  it("blueprint válido passa sem avisos", () => {
    const { blueprint, avisos } = validarBlueprint(
      {
        modo_operacao: "canal_whatsapp",
        cargo_slug: "sdr-imobiliario",
        nome: "Mari",
        tom: "cordial",
        prompt: "Atenda com empatia",
        conhecimento: ["Padrões da empresa"],
        ferramentas: ["hub_lead_resumo", "hub_criar_tarefa"],
        perguntas: ["Qual seu orçamento?"],
      },
      { cargosValidos: CARGOS }
    );
    expect(avisos).toEqual([]);
    expect(blueprint.modo_operacao).toBe("canal_whatsapp");
    expect(blueprint.cargo_slug).toBe("sdr-imobiliario");
    expect(blueprint.ferramentas).toEqual(["hub_lead_resumo", "hub_criar_tarefa"]);
  });

  it("ferramenta ALUCINADA é descartada com aviso", () => {
    const { blueprint, avisos } = validarBlueprint(
      { nome: "X", ferramentas: ["hub_lead_resumo", "hub_ferramenta_que_nao_existe"] },
      { cargosValidos: CARGOS }
    );
    expect(blueprint.ferramentas).toEqual(["hub_lead_resumo"]);
    expect(avisos.some((a) => a.includes("hub_ferramenta_que_nao_existe"))).toBe(true);
  });

  it("cargo desconhecido → null + aviso (nasce só-playbook)", () => {
    const { blueprint, avisos } = validarBlueprint(
      { nome: "X", cargo_slug: "cargo-inventado" },
      { cargosValidos: CARGOS }
    );
    expect(blueprint.cargo_slug).toBeNull();
    expect(avisos.some((a) => a.includes("cargo-inventado"))).toBe(true);
  });

  it("modo default = interno; só canal_whatsapp se explícito", () => {
    expect(validarBlueprint({ nome: "X" }, { cargosValidos: CARGOS }).blueprint.modo_operacao).toBe("interno");
    expect(validarBlueprint({ nome: "X", modo_operacao: "qualquer" }, { cargosValidos: CARGOS }).blueprint.modo_operacao).toBe("interno");
    expect(validarBlueprint({ nome: "X", modo_operacao: "canal_whatsapp" }, { cargosValidos: CARGOS }).blueprint.modo_operacao).toBe("canal_whatsapp");
  });

  it("aceita string com JSON no meio de prosa", () => {
    const raw = 'Claro! Aqui está: {"nome":"Fin","ferramentas":["hub_lead_resumo"]} — pronto.';
    const { blueprint } = validarBlueprint(raw, { cargosValidos: CARGOS });
    expect(blueprint.nome).toBe("Fin");
    expect(blueprint.ferramentas).toEqual(["hub_lead_resumo"]);
  });

  it("dedup de ferramentas repetidas", () => {
    const { blueprint } = validarBlueprint(
      { nome: "X", ferramentas: ["hub_lead_resumo", "hub_lead_resumo"] },
      { cargosValidos: CARGOS }
    );
    expect(blueprint.ferramentas).toEqual(["hub_lead_resumo"]);
  });

  it("entrada vazia/lixo → defaults seguros, nunca lança", () => {
    expect(validarBlueprint(null, { cargosValidos: CARGOS }).blueprint.nome).toBe("Novo agente");
    expect(validarBlueprint("não é json", { cargosValidos: CARGOS }).blueprint.ferramentas).toEqual([]);
  });
});
