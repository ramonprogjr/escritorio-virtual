import { describe, it, expect } from "vitest";
import {
  planejadoDePontos,
  planejadoLinear,
  executadoDeSnapshots,
  executadoAoVivo,
  planejadoNaData,
  indiceHoje,
  calcularKpis,
  montarCurvaS,
  clampPct,
  type PontoPlanejadoInput,
  type SnapshotExecutadoInput,
} from "./cronograma";

// ── planejado: pontos do banco (monotônico, clampa, ordena) ───────────────────
describe("cronograma — planejado a partir dos pontos (E4 aplicado)", () => {
  it("ordena por semana, clampa 0..100 e força não-decrescente (físico × financeiro separados)", () => {
    const pontos: PontoPlanejadoInput[] = [
      { semana: 2, data: "2026-01-15", planejado_pct_fisico: 60, planejado_pct_financeiro: 50 },
      { semana: 0, data: "2026-01-01", planejado_pct_fisico: 0, planejado_pct_financeiro: 0 },
      { semana: 1, data: "2026-01-08", planejado_pct_fisico: 130, planejado_pct_financeiro: 20 }, // clampa 100
    ];
    const out = planejadoDePontos(pontos);
    expect(out.map((p) => p.semana)).toEqual([0, 1, 2]);
    // físico e financeiro são curvas SEPARADAS
    expect(out[1].fisico).toBe(100); // clamp
    expect(out[1].financeiro).toBe(20);
    // monotonicidade: semana 2 físico não pode recuar abaixo de 100 (veio de 130→100 na semana 1)
    expect(out[2].fisico).toBe(100);
    expect(out[2].financeiro).toBe(50);
  });
});

// ── planejado: linear (degrade sem baseline E4) ───────────────────────────────
describe("cronograma — planejado LINEAR (degrade sem migração E4)", () => {
  it("de 0% a 100% entre data_inicio e data_fim, por semana", () => {
    const out = planejadoLinear({ data_inicio: "2026-01-01", data_fim: "2026-01-29" }); // 28 dias = 4 sem
    expect(out[0].fisico).toBe(0);
    expect(out[out.length - 1].fisico).toBe(100);
    // físico = financeiro no modo linear (sem perfil de desembolso ainda)
    expect(out[2].fisico).toBe(out[2].financeiro);
    // tem datas no eixo
    expect(out[0].data).toBe("2026-01-01");
    expect(out[out.length - 1].data).toBe("2026-01-29");
  });

  it("sem datas válidas → eixo ordinal 0..N com data=null (honesto, não inventa calendário)", () => {
    const out = planejadoLinear({ data_inicio: null, data_fim: null }, 4);
    expect(out.length).toBe(5); // 0..4
    expect(out.every((p) => p.data === null)).toBe(true);
    expect(out[0].fisico).toBe(0);
    expect(out[4].fisico).toBe(100);
  });
});

// ── executado: snapshots append-only ──────────────────────────────────────────
describe("cronograma — executado a partir dos snapshots (E4 append-only)", () => {
  it("mantém o ÚLTIMO snapshot por data, ordena, monotônico (físico × financeiro separados)", () => {
    const snaps: SnapshotExecutadoInput[] = [
      { data: "2026-01-08", pct_fisico: 30, pct_financeiro: 20 },
      { data: "2026-01-01", pct_fisico: 10, pct_financeiro: 5 },
      { data: "2026-01-08", pct_fisico: 35, pct_financeiro: 22 }, // sobrescreve o de 08 (último vence)
    ];
    const out = executadoDeSnapshots(snaps);
    expect(out.length).toBe(2);
    expect(out[0].data).toBe("2026-01-01");
    expect(out[1].fisico).toBe(35); // último de 08
    expect(out[1].financeiro).toBe(22);
  });

  it("vazio → []", () => {
    expect(executadoDeSnapshots([])).toEqual([]);
  });
});

// ── executado AO VIVO (degrade quando o append-only está vazio) ───────────────
describe("cronograma — executado AO VIVO (ponderado, físico × financeiro)", () => {
  it("1 ponto com o avanço ponderado; financeiro null → espelha o físico (avanço-só honesto)", () => {
    const out = executadoAoVivo(42, null, "2026-06-30");
    expect(out.length).toBe(1);
    expect(out[0].fisico).toBe(42);
    expect(out[0].financeiro).toBe(42); // sem snapshot E4, financeiro = físico
    expect(out[0].data).toBe("2026-06-30");
  });

  it("financeiro próprio é respeitado (quando vier separado)", () => {
    const out = executadoAoVivo(60, 45, "2026-06-30");
    expect(out[0].fisico).toBe(60);
    expect(out[0].financeiro).toBe(45);
  });
});

// ── planejado na data (interpolação) + índice hoje ────────────────────────────
describe("cronograma — planejado na data (cruza com hoje)", () => {
  const planejado = planejadoLinear({ data_inicio: "2026-01-01", data_fim: "2026-01-29" });

  it("interpola o % planejado para uma data no meio do caminho", () => {
    const meio = planejadoNaData(planejado, "2026-01-15"); // ~50%
    expect(meio).not.toBeNull();
    expect(meio!.fisico).toBeGreaterThan(40);
    expect(meio!.fisico).toBeLessThan(60);
  });

  it("antes do início → 0; depois do fim → 100", () => {
    expect(planejadoNaData(planejado, "2025-12-01")!.fisico).toBe(0);
    expect(planejadoNaData(planejado, "2026-03-01")!.fisico).toBe(100);
  });

  it("eixo ordinal (sem datas) → null (não há calendário p/ cruzar)", () => {
    const ord = planejadoLinear({ data_inicio: null, data_fim: null }, 4);
    expect(planejadoNaData(ord, "2026-06-30")).toBeNull();
  });

  it("indiceHoje aponta o ponto de data <= hoje mais recente", () => {
    const idx = indiceHoje(planejado, "2026-01-15");
    expect(idx).toBeGreaterThanOrEqual(1);
    expect(idx).toBeLessThan(planejado.length);
  });
});

// ── KPIs: desvio vs planejado + status + previsão ─────────────────────────────
describe("cronograma — KPIs honestos", () => {
  const planejado = planejadoLinear({ data_inicio: "2026-01-01", data_fim: "2026-01-29" });
  const baseline = { data_inicio: "2026-01-01", data_fim: "2026-01-29" };

  it("atrasado: executado abaixo do planejado de hoje → desvio negativo + status atrasado", () => {
    const executado = executadoAoVivo(20, null, "2026-01-15"); // ~50% planejado, 20% real
    const k = calcularKpis(planejado, executado, baseline, "2026-01-15", "fisico");
    expect(k.fisicoAtual).toBe(20);
    expect(k.desvioPct).not.toBeNull();
    expect(k.desvioPct!).toBeLessThan(0);
    expect(k.statusPrazo).toBe("atrasado");
  });

  it("adiantado: executado acima do planejado → desvio positivo + status adiantado + previsão", () => {
    const executado = executadoAoVivo(80, null, "2026-01-15"); // 80% real vs ~50% planejado
    const k = calcularKpis(planejado, executado, baseline, "2026-01-15", "fisico");
    expect(k.desvioPct!).toBeGreaterThan(0);
    expect(k.statusPrazo).toBe("adiantado");
    expect(k.previsaoTermino).toBeTruthy(); // projeta término pelo ritmo
  });

  it("lente financeira olha o financeiro, não o físico", () => {
    const executado = executadoAoVivo(80, 30, "2026-01-15");
    const kFin = calcularKpis(planejado, executado, baseline, "2026-01-15", "financeiro");
    expect(kFin.financeiroAtual).toBe(30);
    // financeiro 30 < planejado ~50 → atrasado na lente financeira
    expect(kFin.statusPrazo).toBe("atrasado");
  });

  it("sem datas no planejado → desvio null, status indefinido (não inventa)", () => {
    const ord = planejadoLinear({ data_inicio: null, data_fim: null }, 4);
    const executado = executadoAoVivo(50, null, "2026-06-30");
    const k = calcularKpis(ord, executado, { data_inicio: null, data_fim: null }, "2026-06-30", "fisico");
    expect(k.desvioPct).toBeNull();
    expect(k.statusPrazo).toBe("indefinido");
    expect(k.previsaoTermino).toBeNull();
  });
});

// ── montarCurvaS: decide a fonte com o degrade honesto ────────────────────────
describe("cronograma — montarCurvaS (decisão de fonte + degrade)", () => {
  it("sem pontos E4 → planejado LINEAR; sem snapshots → executado AO VIVO", () => {
    const curva = montarCurvaS({
      baseline: { data_inicio: "2026-01-01", data_fim: "2026-01-29" },
      pontosPlanejados: [],
      snapshots: [],
      fisicoAoVivo: 33,
      financeiroAoVivo: 33,
      hojeISO: "2026-01-15",
    });
    // planejado linear tem início e fim
    expect(curva.planejado[0].fisico).toBe(0);
    expect(curva.planejado[curva.planejado.length - 1].fisico).toBe(100);
    // executado ao vivo = 1 ponto com 33%
    expect(curva.executado.length).toBe(1);
    expect(curva.executado[0].fisico).toBe(33);
    expect(curva.hojeIndex).toBeGreaterThanOrEqual(0);
  });

  it("com pontos E4 → usa a curva planejada do banco; com snapshots → usa o append-only", () => {
    const curva = montarCurvaS({
      baseline: { data_inicio: "2026-01-01", data_fim: "2026-01-29" },
      pontosPlanejados: [
        { semana: 0, data: "2026-01-01", planejado_pct_fisico: 0, planejado_pct_financeiro: 0 },
        { semana: 1, data: "2026-01-08", planejado_pct_fisico: 40, planejado_pct_financeiro: 30 },
      ],
      snapshots: [{ data: "2026-01-08", pct_fisico: 25, pct_financeiro: 15 }],
      fisicoAoVivo: 99, // IGNORADO porque há snapshot
      financeiroAoVivo: 99,
      hojeISO: "2026-01-08",
    });
    expect(curva.planejado[1].fisico).toBe(40);
    expect(curva.executado.length).toBe(1);
    expect(curva.executado[0].fisico).toBe(25); // do snapshot, não o 99 ao vivo
  });
});

// ── clampPct (guard numérico) ─────────────────────────────────────────────────
describe("cronograma — clampPct", () => {
  it("limita 0..100 e trata NaN/null como 0", () => {
    expect(clampPct(150)).toBe(100);
    expect(clampPct(-5)).toBe(0);
    expect(clampPct(null)).toBe(0);
    expect(clampPct(Number.NaN)).toBe(0);
    expect(clampPct(42)).toBe(42);
  });
});
