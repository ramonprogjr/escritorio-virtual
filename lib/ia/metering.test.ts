import { describe, it, expect } from "vitest";
import { registrarConsumoIA, saldoCreditos, CONFIG_PADRAO } from "./metering";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Stub mínimo de Supabase que registra inserts e devolve dados configuráveis. */
function makeDb(rows: Record<string, unknown[]>) {
  const inserts: Record<string, unknown[]> = {};
  const db = {
    from(table: string) {
      return {
        select() {
          return {
            or() {
              return Promise.resolve({ data: rows[table] ?? [], error: null });
            },
            eq() {
              return Promise.resolve({ data: rows[table] ?? [], error: null });
            },
          };
        },
        insert(payload: unknown) {
          inserts[table] = inserts[table] ?? [];
          inserts[table].push(payload);
          return Promise.resolve({ data: null, error: null });
        },
      };
    },
  };
  return { db, inserts };
}

describe("registrarConsumoIA", () => {
  it("grava consumo e movimento de débito usando a config global", async () => {
    // config global: markup 10, fx 6, valor 0.10  →  opus 1000/500 = US$0.0175 → R$1.05 → 11 Tijolos
    const { db, inserts } = makeDb({
      hub_ia_config: [{ escopo: "global", tenant_id: null, markup: 10, fx_usd_brl: 6, valor_credito_brl: 0.1 }],
    });
    const out = await registrarConsumoIA(
      { tenantId: "t1", origem: "cronograma", modelo: "claude-opus-4-8", tokensEntrada: 1000, tokensSaida: 500 },
      db as never,
    );
    expect(out).not.toBeNull();
    expect(out!.creditos).toBe(11);
    expect(inserts.hub_ia_consumo).toHaveLength(1);
    expect(inserts.hub_ia_creditos_mov).toHaveLength(1);
    expect((inserts.hub_ia_creditos_mov[0] as { creditos: number }).creditos).toBe(-11);
  });

  it("é best-effort: erro no banco retorna null sem lançar", async () => {
    const db = {
      from() {
        throw new Error("db down");
      },
    };
    const out = await registrarConsumoIA(
      { tenantId: "t1", origem: "x", modelo: "mistral-small-latest", tokensEntrada: 10, tokensSaida: 10 },
      db as never,
    );
    expect(out).toBeNull();
  });
});

describe("saldoCreditos", () => {
  it("soma os movimentos da carteira", async () => {
    const { db } = makeDb({
      hub_ia_creditos_mov: [{ creditos: 100 }, { creditos: -11 }, { creditos: -5 }],
    });
    const saldo = await saldoCreditos("t1", db as never);
    expect(saldo).toBe(84);
  });
});

describe("CONFIG_PADRAO", () => {
  it("reflete as decisões do dono", () => {
    expect(CONFIG_PADRAO).toEqual({ markup: 10, fxUsdBrl: 6, valorCreditoBrl: 0.1 });
  });
});
