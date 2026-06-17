import { describe, expect, it } from "vitest";
import { parseComandoOperador, textoPareceComandoOperador } from "./operador-comandos";

describe("parseComandoOperador", () => {
  it("global off — variantes", () => {
    expect(parseComandoOperador("/ia-off")?.tipo).toBe("global_off");
    expect(parseComandoOperador("IA OFF")?.tipo).toBe("global_off");
    expect(parseComandoOperador("ia pausar geral")?.tipo).toBe("global_off");
  });

  it("global on — variantes", () => {
    expect(parseComandoOperador("/ia-on")?.tipo).toBe("global_on");
    expect(parseComandoOperador("ia ativar")?.tipo).toBe("global_on");
  });

  it("pausa e retoma por telefone", () => {
    const p = parseComandoOperador("/ia pausa 5511999887766");
    expect(p?.tipo).toBe("pausa_lead");
    if (p?.tipo === "pausa_lead") expect(p.telefoneLead).toBe("5511999887766");

    const r = parseComandoOperador("ia retoma 5511888777666");
    expect(r?.tipo).toBe("retoma_lead");
    if (r?.tipo === "retoma_lead") expect(r.telefoneLead).toBe("5511888777666");
  });

  it("aliases assumir/devolver", () => {
    expect(parseComandoOperador("assumir 5511999887766")?.tipo).toBe("pausa_lead");
    expect(parseComandoOperador("devolver 5511999887766")?.tipo).toBe("retoma_lead");
  });

  it("status e ajuda", () => {
    expect(parseComandoOperador("/ia status")?.tipo).toBe("status");
    expect(parseComandoOperador("ajuda")?.tipo).toBe("ajuda");
  });

  it("telefone inválido em pausa/retoma retorna null", () => {
    expect(parseComandoOperador("/ia pausa abc")).toBeNull();
    expect(parseComandoOperador("/ia pausa 123")).toBeNull();
    expect(parseComandoOperador("ia retoma")).toBeNull();
  });

  it("texto comum de lead não é comando", () => {
    expect(parseComandoOperador("Olá, quero um orçamento")).toBeNull();
    expect(parseComandoOperador("ia off")?.tipo).toBe("global_off");
  });

  it("textoPareceComandoOperador", () => {
    expect(textoPareceComandoOperador("/ia-off")).toBe(true);
    expect(textoPareceComandoOperador("quero ia")).toBe(false);
  });
});
