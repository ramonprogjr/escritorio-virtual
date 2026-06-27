import { describe, expect, it } from "vitest";
import {
  ferramentasRecomendadasPorSetor,
  rotuloSetor,
  setorDoCargo,
  SETOR_AGENTE_IDS,
} from "./agente-setor";
import { isHubAgenteFerramentaId } from "./agente-ferramentas-registry";

describe("setorDoCargo", () => {
  it("Comercial + atendimento → atendimento (especialidade vence segmento)", () => {
    expect(setorDoCargo({ segmento: "Comercial", especialidade: "Atendimento" })).toBe(
      "atendimento"
    );
  });

  it("Comercial + SDR/vendas → comercial", () => {
    expect(setorDoCargo({ segmento: "Comercial", especialidade: "SDR" })).toBe("comercial");
    expect(setorDoCargo({ segmento: "Comercial", especialidade: "Closer de vendas" })).toBe(
      "comercial"
    );
  });

  it("Marketing + tráfego (com e sem acento) → trafego", () => {
    expect(setorDoCargo({ segmento: "Marketing", especialidade: "Tráfego pago" })).toBe("trafego");
    expect(setorDoCargo({ segmento: "Marketing", especialidade: "trafego" })).toBe("trafego");
  });

  it("Marketing + conteúdo → conteudo", () => {
    expect(setorDoCargo({ segmento: "Marketing", especialidade: "Conteúdo" })).toBe("conteudo");
  });

  it("Operações + engenharia/obras → engenharia", () => {
    expect(setorDoCargo({ segmento: "Operações", especialidade: "Engenharia" })).toBe("engenharia");
    expect(setorDoCargo({ segmento: "Operações", especialidade: "Acompanhamento de obra" })).toBe(
      "engenharia"
    );
  });

  it("Operações + financeiro → financeiro", () => {
    expect(setorDoCargo({ segmento: "Operações", especialidade: "Financeiro / cobrança" })).toBe(
      "financeiro"
    );
  });

  it("Operações + RH → rh", () => {
    expect(setorDoCargo({ segmento: "Operações", especialidade: "Recursos Humanos" })).toBe("rh");
  });

  it("fallback por segmento quando especialidade é genérica/ausente", () => {
    expect(setorDoCargo({ segmento: "Comercial", especialidade: "" })).toBe("comercial");
    expect(setorDoCargo({ segmento: "Marketing" })).toBe("marketing");
    expect(setorDoCargo({ segmento: "Operações" })).toBe("operacoes");
  });

  it("fallback final → operacoes quando nada casa", () => {
    expect(setorDoCargo({ segmento: "", especialidade: "" })).toBe("operacoes");
    expect(setorDoCargo({})).toBe("operacoes");
  });
});

describe("rotuloSetor", () => {
  it("devolve rótulo legível para todo setor conhecido", () => {
    for (const s of SETOR_AGENTE_IDS) {
      expect(rotuloSetor(s).length).toBeGreaterThan(0);
    }
  });
});

describe("ferramentasRecomendadasPorSetor", () => {
  it("só devolve IDs que existem no registry, sem duplicados", () => {
    for (const s of SETOR_AGENTE_IDS) {
      const ids = ferramentasRecomendadasPorSetor(s);
      expect(ids.length).toBeGreaterThan(0);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) {
        expect(isHubAgenteFerramentaId(id)).toBe(true);
      }
    }
  });

  it("atendimento e comercial incluem escrita no CRM (atualizar/nota)", () => {
    expect(ferramentasRecomendadasPorSetor("atendimento")).toContain("hub_atualizar_lead");
    expect(ferramentasRecomendadasPorSetor("comercial")).toContain("hub_registar_nota_lead");
  });
});
