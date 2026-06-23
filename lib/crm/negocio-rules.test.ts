import { afterEach, describe, expect, it } from "vitest";
import { validarMudancaNegocio } from "./negocio-rules";

const FLAG = "CRM_PROXIMA_ACAO_OBRIGATORIA";

afterEach(() => {
  delete process.env[FLAG];
});

describe("validarMudancaNegocio — perda exige motivo", () => {
  it("rejeita 'fechado_perdido' sem motivo", () => {
    const r = validarMudancaNegocio({ etapa: "fechado_perdido" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.toLowerCase()).toContain("motivo");
  });

  it("rejeita status 'cancelado' sem motivo", () => {
    expect(validarMudancaNegocio({ status: "cancelado" }).ok).toBe(false);
  });

  it("rejeita motivo de perda inválido", () => {
    expect(
      validarMudancaNegocio({ etapa: "fechado_perdido", motivo_perda: "motivo_que_nao_existe" }).ok
    ).toBe(false);
  });

  it("aceita 'fechado_perdido' com motivo 'outro'", () => {
    expect(validarMudancaNegocio({ etapa: "fechado_perdido", motivo_perda: "outro" }).ok).toBe(true);
  });
});

describe("validarMudancaNegocio — ganho exige pessoa principal", () => {
  it("rejeita 'fechado_ganho' sem pessoa_id", () => {
    const r = validarMudancaNegocio({ etapa: "fechado_ganho" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.toLowerCase()).toContain("pessoa");
  });

  it("aceita 'fechado_ganho' com pessoa_id", () => {
    expect(validarMudancaNegocio({ etapa: "fechado_ganho", pessoa_id: "p-123" }).ok).toBe(true);
  });
});

describe("validarMudancaNegocio — próxima ação obrigatória (flag)", () => {
  it("com flag ON, rejeita etapa intermediária sem próxima ação", () => {
    process.env[FLAG] = "true";
    const r = validarMudancaNegocio({ etapa: "negociacao" });
    expect(r.ok).toBe(false);
  });

  it("com flag ON, aceita com próxima ação", () => {
    process.env[FLAG] = "true";
    expect(validarMudancaNegocio({ etapa: "negociacao", proxima_acao: "Enviar proposta" }).ok).toBe(true);
  });

  it("com flag OFF (default), não exige próxima ação", () => {
    expect(validarMudancaNegocio({ etapa: "negociacao" }).ok).toBe(true);
  });
});
