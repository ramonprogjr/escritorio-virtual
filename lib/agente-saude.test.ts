import { describe, expect, it } from "vitest";
import { calcularSaudeAgente } from "./agente-saude";

describe("calcularSaudeAgente", () => {
  const agora = new Date().toISOString();
  const ha3d = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const ha20d = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
  const ha10d = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

  it("parado quando inativo", () => {
    expect(
      calcularSaudeAgente({
        ativoOperacional: false,
        arquivado: false,
        ciclosAtivosCount: 2,
        logsCiclo: [],
        ultimoPromptEm: agora,
      })
    ).toBe("parado");
  });

  it("ok: ciclos ativos mas zero hub_ciclos_log (antes da 1ª execução)", () => {
    expect(
      calcularSaudeAgente({
        ativoOperacional: true,
        arquivado: false,
        ciclosAtivosCount: 3,
        logsCiclo: [],
        ultimoPromptEm: null,
      })
    ).toBe("ok");
  });

  it("ok: prompt recente (<48h) mesmo sem logs de ciclo", () => {
    expect(
      calcularSaudeAgente({
        ativoOperacional: true,
        arquivado: false,
        ciclosAtivosCount: 2,
        logsCiclo: [],
        ultimoPromptEm: agora,
      })
    ).toBe("ok");
  });

  it("degradado: última execução com erro", () => {
    expect(
      calcularSaudeAgente({
        ativoOperacional: true,
        arquivado: false,
        ciclosAtivosCount: 1,
        logsCiclo: [{ status: "erro", iniciado_em: agora }],
        ultimoPromptEm: agora,
      })
    ).toBe("degradado");
  });

  it("degradado: última sucesso mas >14d", () => {
    expect(
      calcularSaudeAgente({
        ativoOperacional: true,
        arquivado: false,
        ciclosAtivosCount: 1,
        logsCiclo: [{ status: "sucesso", iniciado_em: ha20d }],
        ultimoPromptEm: ha3d,
      })
    ).toBe("degradado");
  });

  it("degradado: ciclos ativos, sem log, prompt antigo >7d", () => {
    expect(
      calcularSaudeAgente({
        ativoOperacional: true,
        arquivado: false,
        ciclosAtivosCount: 1,
        logsCiclo: [],
        ultimoPromptEm: ha10d,
      })
    ).toBe("degradado");
  });
});
