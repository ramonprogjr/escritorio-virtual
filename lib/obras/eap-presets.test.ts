import { describe, it, expect } from "vitest";
import {
  DISCIPLINAS_PADRAO,
  EAP_PRESETS,
  EAP_PRESETS_FALLBACK,
  getPresetPorTipo,
  codigoFrenteFromNome,
  frentesDoPresetParaInsert,
  TIPOS_OBRA,
} from "./eap-presets";

describe("eap-presets — disciplinas e presets", () => {
  it("tem exatamente as 15 disciplinas reais da planilha", () => {
    expect(DISCIPLINAS_PADRAO).toHaveLength(15);
    const slugs = DISCIPLINAS_PADRAO.map((d) => d.slug);
    for (const esperado of [
      "preliminares",
      "civil",
      "demolicoes",
      "revestimento",
      "pintura",
      "eletrica",
      "hidraulica",
      "instalacoes",
      "esquadrias",
      "serralheria",
      "forro",
      "climatizacao",
      "impermeabilizacao",
      "elevadores",
      "limpeza",
    ]) {
      expect(slugs).toContain(esperado);
    }
  });

  it("tem 3 presets globais e Reforma Padrão = 15 frentes (planilha do Consulado)", () => {
    expect(EAP_PRESETS).toHaveLength(3);
    const reforma = getPresetPorTipo("reforma");
    expect(reforma?.slug).toBe("reforma-padrao");
    expect(reforma?.frentes).toHaveLength(15);
  });

  it("getPresetPorTipo devolve undefined para tipo sem preset", () => {
    expect(getPresetPorTipo("manutencao")).toBeUndefined();
  });

  it("o fallback espelha as frentes do preset reforma", () => {
    expect(EAP_PRESETS_FALLBACK).toHaveLength(15);
    expect(EAP_PRESETS_FALLBACK[0]).toHaveProperty("codigo");
    expect(EAP_PRESETS_FALLBACK[0]).toHaveProperty("nome");
  });
});

describe("eap-presets — geração de código de frente", () => {
  it("usa o código da disciplina quando há slug", () => {
    expect(codigoFrenteFromNome("Elétrica", "eletrica")).toBe("ELET");
  });

  it("deriva código do nome (sem acento) quando não há disciplina", () => {
    const c = codigoFrenteFromNome("Área de Lazer");
    expect(c).toMatch(/^[A-Z0-9]+$/);
  });

  it("dedup: Construção (2 civil) gera códigos únicos por obra", () => {
    const preset = getPresetPorTipo("construcao");
    expect(preset).toBeDefined();
    const linhas = frentesDoPresetParaInsert(preset!, "obra-1", "tenant-1");
    const codigos = linhas.map((l) => l.codigo as string);
    expect(new Set(codigos).size).toBe(codigos.length); // todos únicos
    expect(codigos).toContain("CIVIL");
    expect(codigos).toContain("CIVIL2");
  });

  it("frentesDoPresetParaInsert marca origem=preset e tenant_id", () => {
    const preset = getPresetPorTipo("reforma")!;
    const linhas = frentesDoPresetParaInsert(preset, "obra-x", "tenant-x");
    expect(linhas[0].origem).toBe("preset");
    expect(linhas[0].tenant_id).toBe("tenant-x");
    expect(linhas[0].obra_id).toBe("obra-x");
  });
});

describe("eap-presets — tipos de obra", () => {
  it("os 3 principais são construcao/reforma/servico", () => {
    const principais = TIPOS_OBRA.filter((t) =>
      ["construcao", "reforma", "servico"].includes(t.slug)
    );
    expect(principais).toHaveLength(3);
  });
});
