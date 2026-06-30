import { describe, it, expect } from "vitest";
import {
  DISCIPLINAS_PADRAO,
  EAP_PRESETS,
  EAP_PRESETS_FALLBACK,
  getPresetPorTipo,
  codigoFrenteFromNome,
  frentesDoPresetParaInsert,
  mapTipologiaParaTipoObra,
  mapTipologiaParaSegmento,
  getPresetPorSegmento,
  TIPOS_OBRA,
} from "./eap-presets";

describe("eap-presets — mapTipologiaParaTipoObra (A2)", () => {
  it("mapeia os 6 slugs canônicos de tipologia", () => {
    expect(mapTipologiaParaTipoObra("residencial")).toBe("construcao");
    expect(mapTipologiaParaTipoObra("corporativo")).toBe("construcao");
    expect(mapTipologiaParaTipoObra("interiores")).toBe("reforma");
    expect(mapTipologiaParaTipoObra("reforma")).toBe("reforma");
    expect(mapTipologiaParaTipoObra("comercial")).toBe("servico");
    expect(mapTipologiaParaTipoObra("paisagismo")).toBe("servico");
  });

  it("é case-insensitive e tolera espaços", () => {
    expect(mapTipologiaParaTipoObra("  Residencial  ")).toBe("construcao");
    expect(mapTipologiaParaTipoObra("COMERCIAL")).toBe("servico");
  });

  it("default seguro 'reforma' para null/desconhecido (campo livre)", () => {
    expect(mapTipologiaParaTipoObra(null)).toBe("reforma");
    expect(mapTipologiaParaTipoObra(undefined)).toBe("reforma");
    expect(mapTipologiaParaTipoObra("")).toBe("reforma");
    expect(mapTipologiaParaTipoObra("loft futurista")).toBe("reforma");
  });

  it("o tipo derivado sempre tem preset de EAP", () => {
    for (const slug of ["residencial", "corporativo", "interiores", "reforma", "comercial", "paisagismo", "xpto"]) {
      const tipo = mapTipologiaParaTipoObra(slug);
      expect(getPresetPorTipo(tipo)).toBeDefined();
    }
  });
});

// R1 (ESTRUTURA-UNIFICADA §7 Fase 0) — handoff Arq→Obra: a tipologia do projeto deriva o SEGMENTO
// que o orquestrador /gerar-obra passa a criarObraComEAP. SÓ com um segmento VÁLIDO a obra nasce
// com a árvore ambiente→item (semearItensPorAmbiente); sem mapeamento → null (degrade genérico).
describe("eap-presets — mapTipologiaParaSegmento (R1 handoff)", () => {
  it("mapeia as tipologias com preset por segmento", () => {
    expect(mapTipologiaParaSegmento("residencial")).toBe("residencial");
    expect(mapTipologiaParaSegmento("comercial")).toBe("comercial");
    expect(mapTipologiaParaSegmento("corporativo")).toBe("corporativo");
    expect(mapTipologiaParaSegmento("clinicas")).toBe("clinicas");
    expect(mapTipologiaParaSegmento("clinica")).toBe("clinicas"); // sinônimo singular
    expect(mapTipologiaParaSegmento("pdv")).toBe("pdv");
  });

  it("é case-insensitive e tolera espaços", () => {
    expect(mapTipologiaParaSegmento("  Residencial  ")).toBe("residencial");
    expect(mapTipologiaParaSegmento("PDV")).toBe("pdv");
  });

  it("degrade SEGURO = null para tipologias sem preset por segmento (não força segmento errado)", () => {
    expect(mapTipologiaParaSegmento("interiores")).toBeNull();
    expect(mapTipologiaParaSegmento("reforma")).toBeNull();
    expect(mapTipologiaParaSegmento("paisagismo")).toBeNull();
    expect(mapTipologiaParaSegmento(null)).toBeNull();
    expect(mapTipologiaParaSegmento(undefined)).toBeNull();
    expect(mapTipologiaParaSegmento("")).toBeNull();
    expect(mapTipologiaParaSegmento("loft futurista")).toBeNull();
  });

  it("todo segmento mapeado tem preset por segmento (a obra nasce com itens por ambiente)", () => {
    for (const tipologia of ["residencial", "comercial", "corporativo", "clinicas", "pdv"]) {
      const seg = mapTipologiaParaSegmento(tipologia);
      expect(seg).not.toBeNull();
      expect(getPresetPorSegmento(seg as string)).toBeDefined();
    }
  });
});

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
