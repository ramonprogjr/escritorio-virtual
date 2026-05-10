import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { assinarParceiroPortal, parceiroPortalValido } from "./parceiro-portal";

describe("parceiroPortal", () => {
  const prev = process.env.PORTAL_HMAC_SECRET;

  beforeEach(() => {
    process.env.PORTAL_HMAC_SECRET = "unit_test_secret";
  });

  afterEach(() => {
    process.env.PORTAL_HMAC_SECRET = prev;
  });

  it("signs and validates same id", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    const s = assinarParceiroPortal(id);
    expect(parceiroPortalValido(id, s)).toBe(true);
  });

  it("rejects tampered signature", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    expect(parceiroPortalValido(id, "deadbeef".repeat(8))).toBe(false);
  });
});
