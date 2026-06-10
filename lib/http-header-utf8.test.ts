import { describe, expect, it } from "vitest";
import { decodeHttpHeaderValue, encodeHttpHeaderValue } from "./http-header-utf8";

describe("http-header-utf8", () => {
  it("mantém ASCII sem prefixo", () => {
    expect(encodeHttpHeaderValue("Carlos")).toBe("Carlos");
  });

  it("codifica nomes com acentos", () => {
    const encoded = encodeHttpHeaderValue("José da Silva");
    expect(encoded.startsWith("b64:")).toBe(true);
    expect(decodeHttpHeaderValue(encoded)).toBe("José da Silva");
  });
});
