import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { assinarConviteParceiro, conviteParceiroValido } from "./parceiro-convite";
import { assinarParceiroPortal } from "../parceiro-portal";

/**
 * Núcleo de segurança da Fase 2 do parceiro: só credita "quem convidou" quando o HMAC
 * confere. Estes testes travam o contrato anti-forja (precedente H-SEC-3) — sem eles,
 * uma regressão no payload/segredo passaria despercebida e reabriria a fraude de comissão.
 */
describe("conviteParceiro (HMAC quem-convidou)", () => {
  const prev = process.env.PORTAL_HMAC_SECRET;
  const userId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    process.env.PORTAL_HMAC_SECRET = "unit_test_secret";
  });

  afterEach(() => {
    process.env.PORTAL_HMAC_SECRET = prev;
  });

  it("assina e valida o mesmo userId", () => {
    const sig = assinarConviteParceiro(userId);
    expect(conviteParceiroValido(userId, sig)).toBe(true);
  });

  it("rejeita assinatura forjada (mesmo comprimento)", () => {
    expect(conviteParceiroValido(userId, "deadbeef".repeat(8))).toBe(false);
  });

  it("rejeita assinatura de outro userId (não reaproveitável)", () => {
    const sig = assinarConviteParceiro(userId);
    expect(conviteParceiroValido("00000000-0000-0000-0000-000000000001", sig)).toBe(false);
  });

  it("rejeita userId ou assinatura vazios (fail-closed)", () => {
    expect(conviteParceiroValido("", assinarConviteParceiro(userId))).toBe(false);
    expect(conviteParceiroValido(userId, "")).toBe(false);
  });

  it("domain separation: um sig do PORTAL não vale como sig de CONVITE (mesmo segredo)", () => {
    // Mesmo userId, mesmo segredo, mas payloads domain-separados ("convite-parceiro:" x cru).
    const sigPortal = assinarParceiroPortal(userId);
    expect(conviteParceiroValido(userId, sigPortal)).toBe(false);
  });
});
