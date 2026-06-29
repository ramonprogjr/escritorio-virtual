import { describe, it, expect } from "vitest";
import {
  SEGMENTOS,
  isSegmentoValido,
  TAXONOMIA_FALLBACK,
  taxonomiaPorCodigo,
  taxonomiaPorDisciplina,
  fallbackComoRows,
  AMBIENTES_POR_SEGMENTO,
  ambientesDoSegmento,
} from "./taxonomia";
import {
  EAP_PRESETS,
  EAP_PRESETS_SEGMENTO,
  TODOS_PRESETS,
  getPresetPorSegmento,
  getPresetPorTipo,
} from "./eap-presets";

describe("taxonomia — segmentos", () => {
  it("tem os 5 segmentos do design (residencial/comercial/corporativo/clinicas/pdv)", () => {
    const slugs = SEGMENTOS.map((s) => s.slug);
    expect(slugs).toEqual(["residencial", "comercial", "corporativo", "clinicas", "pdv"]);
  });

  it("isSegmentoValido aceita só os 5 e recusa o resto", () => {
    expect(isSegmentoValido("residencial")).toBe(true);
    expect(isSegmentoValido("pdv")).toBe(true);
    expect(isSegmentoValido("industrial")).toBe(false);
    expect(isSegmentoValido(null)).toBe(false);
    expect(isSegmentoValido(undefined)).toBe(false);
    expect(isSegmentoValido("")).toBe(false);
  });
});

describe("taxonomia — seed in-code (fallback)", () => {
  it("traz a Elétrica completa do dono (6 atividades-chave)", () => {
    for (const codigo of [
      "ELET-DADOS-VOZ",
      "ELET-TOMADA-110",
      "ELET-TOMADA-030",
      "ELET-ILUM-LED",
      "ELET-ILUM-PLAFON",
      "ELET-QDL",
    ]) {
      expect(taxonomiaPorCodigo(codigo)).toBeDefined();
    }
  });

  it("Tomada 1,10m tem sinônimos para a IA classificar", () => {
    const t = taxonomiaPorCodigo("ELET-TOMADA-110");
    expect(t?.nome).toBe("Tomada 1,10m");
    expect(t?.sinonimos).toContain("tug");
    expect(t?.descricao_padrao.length).toBeGreaterThan(10);
  });

  it("cobre as 5 disciplinas-núcleo", () => {
    for (const disc of ["eletrica", "civil", "hidraulica", "revestimento", "pintura"]) {
      expect(taxonomiaPorDisciplina(disc).length).toBeGreaterThan(0);
    }
  });

  it("todos os códigos são únicos", () => {
    const codigos = TAXONOMIA_FALLBACK.map((a) => a.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
  });

  it("qtd_padrao é null por default (humano confirma — v1 do dono); só QDL sugere 1", () => {
    const semQtd = TAXONOMIA_FALLBACK.filter((a) => a.qtd_padrao === null);
    expect(semQtd.length).toBeGreaterThan(0);
    expect(taxonomiaPorCodigo("ELET-QDL")?.qtd_padrao).toBe(1);
  });

  it("fallbackComoRows marca origem=sistema, tenant_id=null, ativo=true", () => {
    const rows = fallbackComoRows();
    expect(rows).toHaveLength(TAXONOMIA_FALLBACK.length);
    expect(rows[0].origem).toBe("sistema");
    expect(rows[0].tenant_id).toBeNull();
    expect(rows[0].ativo).toBe(true);
    expect(rows[0].id).toMatch(/^fallback-/);
  });
});

describe("taxonomia — ambientes por segmento", () => {
  it("cada segmento tem entre 5 e 8 ambientes sugeridos", () => {
    for (const s of SEGMENTOS) {
      const amb = AMBIENTES_POR_SEGMENTO[s.slug];
      expect(amb.length).toBeGreaterThanOrEqual(5);
      expect(amb.length).toBeLessThanOrEqual(8);
    }
  });

  it("ambientesDoSegmento devolve [] para segmento inválido", () => {
    expect(ambientesDoSegmento("industrial")).toEqual([]);
    expect(ambientesDoSegmento(null)).toEqual([]);
    expect(ambientesDoSegmento("corporativo").length).toBeGreaterThan(0);
  });
});

describe("taxonomia × presets por segmento (integração)", () => {
  it("os 3 presets genéricos seguem SEM segmento (intocados)", () => {
    expect(EAP_PRESETS).toHaveLength(3);
    for (const p of EAP_PRESETS) {
      expect(p.segmento).toBeUndefined();
    }
  });

  it("há 5 presets por segmento, um por segmento do design", () => {
    expect(EAP_PRESETS_SEGMENTO).toHaveLength(5);
    const segs = EAP_PRESETS_SEGMENTO.map((p) => p.segmento).sort();
    expect(segs).toEqual(["clinicas", "comercial", "corporativo", "pdv", "residencial"]);
  });

  it("TODOS_PRESETS = genéricos + por segmento", () => {
    expect(TODOS_PRESETS).toHaveLength(EAP_PRESETS.length + EAP_PRESETS_SEGMENTO.length);
  });

  it("getPresetPorSegmento e getPresetPorTipo não colidem (tipo ignora os de segmento)", () => {
    // getPresetPorTipo('reforma') deve devolver o genérico, NUNCA um preset de segmento.
    const genericoReforma = getPresetPorTipo("reforma");
    expect(genericoReforma?.slug).toBe("reforma-padrao");
    expect(genericoReforma?.segmento).toBeUndefined();
    // getPresetPorSegmento resolve o por-segmento.
    expect(getPresetPorSegmento("corporativo")?.slug).toBe("corporativo-padrao");
    expect(getPresetPorSegmento("industrial")).toBeUndefined();
  });

  it("toda atividade_default dos presets aponta a um código existente na taxonomia", () => {
    for (const p of EAP_PRESETS_SEGMENTO) {
      for (const f of p.frentes) {
        for (const amb of f.ambientes ?? []) {
          for (const a of amb.atividades_default) {
            expect(
              taxonomiaPorCodigo(a.codigo),
              `${p.slug} → ${amb.codigo} → ${a.codigo} deve existir na taxonomia`
            ).toBeDefined();
          }
        }
      }
    }
  });
});
