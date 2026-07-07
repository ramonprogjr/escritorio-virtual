import { describe, expect, it } from "vitest";
import { montarFunilDoHub, type FunilLeadRow } from "./funil-do-hub";

const leads: FunilLeadRow[] = [
  { id: "L1", estagio: "encaminhado", valor_estimado: 100, origem: "google_ads", metadata: { mercado_principal: "ARQ" } },
  { id: "L2", estagio: "convertido_negocio", valor_estimado: 200, origem: "whatsapp", metadata: { mercado_principal: "IMO" } },
  { id: "L3", estagio: "novo", valor_estimado: 50, origem: "whatsapp", metadata: { mercado_principal: "ARQ" } },
];
const vinculos = [
  { negocio_id: "N1", entidade_id: "L1" },
  { negocio_id: "N2", entidade_id: "L2" },
];
const negocios = [
  { id: "N1", status: "aberto", valor_estimado: 120 },
  { id: "N2", status: "fechado_ganho", valor_estimado: 220 },
  { id: "N3", status: "aberto", valor_estimado: 999 }, // sem lead de origem
];
const obras = [{ negocio_id: "N1", status: "ativa" }];

describe("montarFunilDoHub — coorte de leads na rede", () => {
  it("monta os 5 elos como subconjuntos decrescentes (nunca >100%)", () => {
    const r = montarFunilDoHub({ leads, vinculos, negocios, obras });
    const by = Object.fromEntries(r.elos.map((e) => [e.key, e]));
    expect(by.captada.count).toBe(3);
    expect(by.roteada.count).toBe(2); // L1 encaminhado, L2 convertido/tem negócio
    expect(by.aceita.count).toBe(2); // L1(N1 aberto), L2(N2 ganho)
    expect(by.execucao.count).toBe(1); // só N1 tem obra
    expect(by.paga.count).toBe(1); // só N2 é fechado_ganho
    for (const e of r.elos) {
      if (e.pctDaCaptacao != null) expect(e.pctDaCaptacao).toBeLessThanOrEqual(100);
    }
  });

  it("negócio sem lead de origem NÃO entra na coorte, mas é contado à parte", () => {
    const r = montarFunilDoHub({ leads, vinculos, negocios, obras });
    expect(r.negociosSemLead).toBe(1); // N3
  });

  it("fatia por MERCADO (só a coorte daquele mercado)", () => {
    const r = montarFunilDoHub({ leads, vinculos, negocios, obras, filtro: { mercado: "ARQ" } });
    const cap = r.elos.find((e) => e.key === "captada")!;
    expect(cap.count).toBe(2); // L1 + L3
    expect(cap.valor).toBe(150);
  });

  it("fatia por ORIGEM (só a coorte daquele canal)", () => {
    const r = montarFunilDoHub({ leads, vinculos, negocios, obras, filtro: { origem: "whatsapp" } });
    const cap = r.elos.find((e) => e.key === "captada")!;
    expect(cap.count).toBe(2); // L2 + L3
    const aceita = r.elos.find((e) => e.key === "aceita")!;
    expect(aceita.count).toBe(1); // só L2 tem negócio
  });

  it("expõe as listas de mercado e origem para os filtros", () => {
    const r = montarFunilDoHub({ leads, vinculos, negocios, obras });
    expect(r.mercados.map((m) => m.valor).sort()).toEqual(["ARQ", "IMO"]);
    expect(r.origens.map((o) => o.valor).sort()).toEqual(["google_ads", "whatsapp"]);
  });
});
