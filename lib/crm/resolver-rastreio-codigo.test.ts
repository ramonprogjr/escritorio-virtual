import { describe, expect, it } from "vitest";
import { normalizarCodigoRastreio } from "./resolver-rastreio-codigo";

describe("normalizarCodigoRastreio — aceita legado e compacto", () => {
  it("compacto novo (PS2026001, NGIMB2026001, EM2026010)", () => {
    expect(normalizarCodigoRastreio("PS2026001")).toBe("PS2026001");
    expect(normalizarCodigoRastreio("ngimb2026001")).toBe("NGIMB2026001");
    expect(normalizarCodigoRastreio(" em2026010 ")).toBe("EM2026010");
  });

  it("legado (PES-2026-0001) continua válido", () => {
    expect(normalizarCodigoRastreio("PES-2026-0001")).toBe("PES-2026-0001");
    expect(normalizarCodigoRastreio("neg-2026-0042")).toBe("NEG-2026-0042");
  });

  it("lixo é rejeitado", () => {
    expect(normalizarCodigoRastreio("")).toBeNull();
    expect(normalizarCodigoRastreio("ABC")).toBeNull();
    expect(normalizarCodigoRastreio("12345")).toBeNull();
  });
});
