import { describe, expect, it } from "vitest";
import { frescorLead } from "./sla-frescor";

const AGORA = new Date("2026-06-24T12:00:00.000Z").getTime();
const isoMinAtras = (m: number) => new Date(AGORA - m * 60000).toISOString();

describe("frescorLead — indicador de frescor do lead", () => {
  it("novo (verde) < 5min", () => {
    expect(frescorLead(isoMinAtras(0), AGORA)?.nivel).toBe("novo");
    expect(frescorLead(isoMinAtras(4), AGORA)?.nivel).toBe("novo");
    expect(frescorLead(isoMinAtras(4), AGORA)?.cor).toBe("#22C55E");
  });
  it("atencao (amarelo) entre 5 e 15min", () => {
    expect(frescorLead(isoMinAtras(5), AGORA)?.nivel).toBe("atencao");
    expect(frescorLead(isoMinAtras(14), AGORA)?.nivel).toBe("atencao");
  });
  it("atrasado (vermelho) >= 15min", () => {
    expect(frescorLead(isoMinAtras(15), AGORA)?.nivel).toBe("atrasado");
    expect(frescorLead(isoMinAtras(120), AGORA)?.cor).toBe("#EF4444");
  });
  it("null para iso ausente; atrasado para iso inválido", () => {
    expect(frescorLead(null, AGORA)).toBeNull();
    expect(frescorLead(undefined, AGORA)).toBeNull();
    expect(frescorLead("data-invalida", AGORA)?.nivel).toBe("atrasado");
  });
});
