import { describe, expect, it } from "vitest";
import {
  formatarTelefoneBrasil,
  formatarTelefoneMascara,
  parseTelefoneBrasil,
  telefoneDigitsCopia,
} from "./telefone-brasil";

describe("telefone-brasil", () => {
  it("interpreta 55 como código do país", () => {
    const p = parseTelefoneBrasil("5511932066145");
    expect(p?.ddd).toBe("11");
    expect(p?.e164).toBe("5511932066145");
    expect(formatarTelefoneBrasil("5511932066145")).toBe("+55 (11) 93206-6145");
  });

  it("formata DDD 48 (Sul)", () => {
    const p = parseTelefoneBrasil("554891447974");
    expect(p?.ddd).toBe("48");
    expect(p?.regiao).toBe("sul");
    expect(p?.uf).toBe("SC");
  });

  it("copia dígitos E.164", () => {
    expect(telefoneDigitsCopia("(11) 98598-0273")).toBe("5511985980273");
  });

  it("máscara de digitação progressiva (celular 11 dígitos)", () => {
    expect(formatarTelefoneMascara("")).toBe("");
    expect(formatarTelefoneMascara("11")).toBe("(11");
    expect(formatarTelefoneMascara("1193")).toBe("(11) 93");
    expect(formatarTelefoneMascara("11932066")).toBe("(11) 9320-66");
    expect(formatarTelefoneMascara("11932066145")).toBe("(11) 93206-6145");
  });

  it("máscara de fixo (10 dígitos)", () => {
    expect(formatarTelefoneMascara("4833221100")).toBe("(48) 3322-1100");
  });

  it("máscara ignora não-dígitos e limita a 11", () => {
    expect(formatarTelefoneMascara("(11) 93206-6145 ramal 9")).toBe("(11) 93206-6145");
  });
});
