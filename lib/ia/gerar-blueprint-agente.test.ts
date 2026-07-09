import { describe, expect, it } from "vitest";
import { montarSystemBlueprint } from "./gerar-blueprint-agente";

/** O prompt precisa listar os catálogos REAIS (ferramentas + cargos) para a IA não inventar ids. */
describe("montarSystemBlueprint", () => {
  it("inclui ids REAIS de ferramentas do registry", () => {
    const s = montarSystemBlueprint([]);
    expect(s).toContain("hub_lead_resumo");
    expect(s).toContain("hub_atualizar_lead");
  });

  it("inclui os cargos fornecidos", () => {
    const s = montarSystemBlueprint([{ slug: "sdr-imobiliario", desc: "Qualifica leads" }]);
    expect(s).toContain("sdr-imobiliario");
    expect(s).toContain("Qualifica leads");
  });

  it("sem cargos: instrui a usar null", () => {
    expect(montarSystemBlueprint([])).toContain("cargo_slug null");
  });

  it("default interno + JSON-only", () => {
    const s = montarSystemBlueprint([]);
    expect(s).toContain("interno");
    expect(s.toLowerCase()).toContain("json");
  });
});
