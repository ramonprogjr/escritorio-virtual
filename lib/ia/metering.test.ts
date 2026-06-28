import { describe, it, expect } from "vitest";
import { registrarConsumoIA, saldoCreditos, carregarTabelaPrecos, CONFIG_PADRAO } from "./metering";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Stub mínimo de Supabase que registra inserts e devolve dados configuráveis.
 *  Para `hub_ia_precos`, o `select()` é AWAITABLE direto (sem .or/.eq) — é assim que
 *  carregarTabelaPrecos consulta a tabela de preços do painel. */
function makeDb(rows: Record<string, unknown[]>) {
  const inserts: Record<string, unknown[]> = {};
  const db = {
    from(table: string) {
      return {
        select() {
          // hub_ia_precos é consultado com await direto no select() (sem encadear).
          const result = { data: rows[table] ?? [], error: null };
          const thenable = {
            or() {
              return Promise.resolve(result);
            },
            eq() {
              return Promise.resolve(result);
            },
            // Torna o próprio retorno do select() awaitable (caso hub_ia_precos).
            then(onFulfilled: (v: typeof result) => unknown) {
              return Promise.resolve(result).then(onFulfilled);
            },
          };
          return thenable;
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

describe("carregarTabelaPrecos", () => {
  it("converte hub_ia_precos (só modelos ativos) para o shape de cálculo", async () => {
    const { db } = makeDb({
      hub_ia_precos: [
        { modelo: "claude-opus-4-8", input_usd_milhao: 7, output_usd_milhao: 30, ativo: true },
        { modelo: "modelo-desativado", input_usd_milhao: 1, output_usd_milhao: 2, ativo: false },
      ],
    });
    const tabela = await carregarTabelaPrecos(db as never);
    expect(tabela).toBeDefined();
    expect(tabela!["claude-opus-4-8"]).toEqual({ inputUsdMilhao: 7, outputUsdMilhao: 30 });
    expect(tabela!["modelo-desativado"]).toBeUndefined();
  });

  it("tabela vazia → undefined (cai nos preços de referência)", async () => {
    const { db } = makeDb({ hub_ia_precos: [] });
    expect(await carregarTabelaPrecos(db as never)).toBeUndefined();
  });

  it("erro/exceção no banco → undefined (tolerante)", async () => {
    const db = {
      from() {
        throw new Error("sem tabela");
      },
    };
    expect(await carregarTabelaPrecos(db as never)).toBeUndefined();
  });
});

describe("registrarConsumoIA usa os preços do painel quando existem", () => {
  it("preço editado em hub_ia_precos sobrepõe PRECOS_MODELOS", async () => {
    // opus dobrado no painel: input 10, output 50 (vs ref 5/25).
    // 1000*10 + 500*50 = 35000 / 1e6 = US$0.035 → *6*10 = R$2.10 → 21 Tijolos.
    const { db, inserts } = makeDb({
      hub_ia_config: [{ escopo: "global", tenant_id: null, markup: 10, fx_usd_brl: 6, valor_credito_brl: 0.1 }],
      hub_ia_precos: [
        { modelo: "claude-opus-4-8", input_usd_milhao: 10, output_usd_milhao: 50, ativo: true },
      ],
    });
    const out = await registrarConsumoIA(
      { tenantId: "t1", origem: "cronograma", modelo: "claude-opus-4-8", tokensEntrada: 1000, tokensSaida: 500 },
      db as never,
    );
    expect(out).not.toBeNull();
    expect(out!.creditos).toBe(21);
    expect((inserts.hub_ia_consumo[0] as { custo_usd: number }).custo_usd).toBeCloseTo(0.035, 6);
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
