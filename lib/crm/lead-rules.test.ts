import { afterEach, describe, expect, it } from "vitest";
import { validarMudancaEstagioLead } from "./lead-rules";

const FLAG = "CRM_PROXIMA_ACAO_OBRIGATORIA";

afterEach(() => {
  delete process.env[FLAG];
});

describe("validarMudancaEstagioLead — perda exige motivo", () => {
  it("rejeita 'perdido' sem motivo", () => {
    const r = validarMudancaEstagioLead({ estagio_funil: "perdido" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.toLowerCase()).toContain("motivo");
  });

  it("rejeita 'spam_invalido' sem motivo", () => {
    expect(validarMudancaEstagioLead({ estagio_funil: "spam_invalido" }).ok).toBe(false);
  });

  it("rejeita 'perdido' via campo estagio (legado) sem motivo", () => {
    expect(validarMudancaEstagioLead({ estagio: "perdido" }).ok).toBe(false);
  });

  it("aceita 'perdido' com motivo válido", () => {
    expect(validarMudancaEstagioLead({ estagio_funil: "perdido", motivo_perda: "outro" }).ok).toBe(true);
  });

  it("aceita avanço normal (etapa ativa) sem flag", () => {
    expect(validarMudancaEstagioLead({ estagio_funil: "qualificando" }).ok).toBe(true);
  });
});

describe("validarMudancaEstagioLead — próxima ação obrigatória (flag)", () => {
  it("com flag ON, rejeita etapa ativa sem próxima ação", () => {
    process.env[FLAG] = "true";
    const r = validarMudancaEstagioLead({ estagio_funil: "em_atendimento" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.toLowerCase()).toContain("próxima ação");
  });

  it("com flag ON, aceita etapa ativa com próxima ação", () => {
    process.env[FLAG] = "true";
    expect(
      validarMudancaEstagioLead({ estagio_funil: "em_atendimento", proxima_acao: "Ligar amanhã" }).ok
    ).toBe(true);
  });

  it("com flag OFF (default), não exige próxima ação", () => {
    expect(validarMudancaEstagioLead({ estagio_funil: "em_atendimento" }).ok).toBe(true);
  });
});
