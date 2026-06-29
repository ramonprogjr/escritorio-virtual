/**
 * E7 — espelho em TS do CONTRATO da migração 20260815120000_e7_item_escopo_unificado.sql.
 *
 * Trava a regra que o SQL materializa (GENERATED + views), para que UI e endpoint (que calculam
 * in-code no fallback "migração pendente") NUNCA divirjam do banco quando a migração for aplicada:
 *   - custo_total = soma_inline(locacao+material+mo) × quantidade  (NÃO custo_unitario × qtd: o
 *     Postgres não encadeia GENERATED; o SQL repete a soma inline — aqui asseguramos o MESMO número);
 *   - BDI de 3 camadas: COALESCE(item.bdi_fator, obra.bdi_fator, 1.0);
 *   - peso financeiro só sobre itens-RAIZ (parent_id IS NULL) — nunca conta pai + subitem em dobro;
 *   - margem_pct NULL quando não há preço (custo 0/NULL).
 */
import { describe, it, expect } from "vitest";
import {
  custoUnitario,
  custoTotal,
  bdiEfetivo,
  precoTotal,
  margemPct,
  calcularItem,
  pesosNormalizados,
  type ItemEscopoCalc,
} from "./escopo";

describe("E7 — custo_total (GENERATED: soma inline × quantidade)", () => {
  it("repete a soma inline × qtd (espelha o SQL — não usa custo_unitario × qtd encadeado)", () => {
    // K=10, L=20, M=20 → unit 50; qtd 17 → total 850. Mesmo número que a coluna GENERATED do E7.
    const item = { custo_locacao_frete: 10, custo_material: 20, custo_mao_obra: 20, quantidade: 17 };
    expect(custoUnitario(item)).toBe(50);
    expect(custoTotal(item)).toBe(850);
  });

  it("NULL em qualquer parcela conta como 0 (COALESCE(...,0) do SQL)", () => {
    expect(custoUnitario({ custo_locacao_frete: null, custo_material: 20, custo_mao_obra: null })).toBe(20);
  });

  it("quantidade NULL → custo_total NULL (a coluna não vira 0 enganoso)", () => {
    expect(custoTotal({ custo_material: 50, quantidade: null })).toBeNull();
  });
});

describe("E7 — BDI 3 camadas (COALESCE item → obra → 1.0)", () => {
  it("override do item vence", () => {
    expect(bdiEfetivo(1.155, 1.06)).toBe(1.155);
  });
  it("sem item, usa a obra", () => {
    expect(bdiEfetivo(null, 1.06)).toBe(1.06);
  });
  it("sem item e sem obra, 1.0 neutro (preserva legado)", () => {
    expect(bdiEfetivo(null, null)).toBe(1.0);
  });
  it("preço = custo_total × BDI efetivo (a empresa que usa 1.06 seta 1 número)", () => {
    expect(precoTotal(850, bdiEfetivo(null, 1.06))).toBe(901);
  });
});

describe("E7 — margem_pct NULL sem preço (UI mostra —, nunca NaN)", () => {
  it("sem custo → margem null", () => {
    expect(margemPct(null, 1.06)).toBeNull();
  });
  it("BDI 1.0 (sem markup) → margem 0, não null (há preço)", () => {
    expect(margemPct(500, 1.0)).toBe(0);
  });
});

describe("E7 — vw_hub_obra_item_peso: peso só sobre itens-RAIZ (parent_id IS NULL)", () => {
  it("subitem (parent_id != null) NÃO entra no peso (não dobra pai + subitem)", () => {
    const itens: ItemEscopoCalc[] = [
      calcularItem({ id: "pai", parent_id: null, custo_material: 200, quantidade: 1 }, 1.0),
      calcularItem({ id: "filho", parent_id: "pai", custo_material: 9999, quantidade: 1 }, 1.0),
    ];
    const pesos = pesosNormalizados(itens);
    expect(pesos.get("pai")).toBe(1); // único raiz → 100% do peso
    expect(pesos.has("filho")).toBe(false);
  });

  it("total 0 (sem custo em nenhuma raiz) → peso NULL (degrada p/ média simples)", () => {
    const itens: ItemEscopoCalc[] = [
      calcularItem({ id: "r", parent_id: null, pct_avanco: 10 }, 1.0),
    ];
    expect(pesosNormalizados(itens).get("r")).toBeNull();
  });
});
