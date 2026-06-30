/**
 * E7c (Fase 3a) — trava a regra do pct_avanco_resultante DERIVADO da quantidade física (medicao.ts).
 *
 * Espelho da derivação que o endpoint POST /medicoes aplica antes de gravar o item-mãe:
 *   - quantidade física vs. planejada → pct físico real (clamp 0..100);
 *   - sem planejada → cai no pct informado;
 *   - nada utilizável → null (o endpoint preserva o pct atual do item, não zera).
 */
import { describe, it, expect } from "vitest";
import { derivarPctAvanco, clampPct, round2 } from "./medicao";

describe("E7c — derivarPctAvanco (pct resultante derivado da quantidade física)", () => {
  it("quantidade realizada / planejada → pct físico (12 de 24 = 50%)", () => {
    expect(derivarPctAvanco(12, 24, null)).toBe(50);
  });

  it("realizada = planejada → 100%", () => {
    expect(derivarPctAvanco(24, 24, null)).toBe(100);
  });

  it("realizada > planejada → CLAMP em 100 (não passa de 100)", () => {
    expect(derivarPctAvanco(30, 24, null)).toBe(100);
  });

  it("realizada 0 com planejada > 0 → 0% (quantidade física vence o pct informado)", () => {
    expect(derivarPctAvanco(0, 24, 80)).toBe(0);
  });

  it("a quantidade física TEM PRECEDÊNCIA sobre o pct informado quando há planejada", () => {
    // realizada 6 de 24 = 25% (ignora o pct informado 90, pois há base física).
    expect(derivarPctAvanco(6, 24, 90)).toBe(25);
  });

  it("sem quantidade planejada → usa o pct informado (clampado)", () => {
    expect(derivarPctAvanco(null, null, 73)).toBe(73);
    expect(derivarPctAvanco(null, 0, 150)).toBe(100); // planejada 0 não é base → pct, clampado
    expect(derivarPctAvanco(null, null, -5)).toBe(0);
  });

  it("nada utilizável (sem realizada, sem planejada, sem pct) → null (endpoint preserva o atual)", () => {
    expect(derivarPctAvanco(null, null, null)).toBeNull();
    expect(derivarPctAvanco(null, 24, null)).toBeNull(); // planejada mas sem realizada nem pct
  });

  it("frações arredondam a 2 casas (1 de 3 = 33.33%)", () => {
    expect(derivarPctAvanco(1, 3, null)).toBe(33.33);
  });
});

describe("E7c — helpers (clamp/round)", () => {
  it("clampPct limita a [0,100] e trata não-finito como 0", () => {
    expect(clampPct(120)).toBe(100);
    expect(clampPct(-3)).toBe(0);
    expect(clampPct(NaN)).toBe(0);
    expect(clampPct(42)).toBe(42);
  });
  it("round2 arredonda a 2 casas", () => {
    expect(round2(33.3333)).toBe(33.33);
  });
});
