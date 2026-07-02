import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aggregateCockpit } from "./cockpit-aggregate";
import { hojeISODate } from "./cockpit-classificar";

/** Offset em dias sobre um YYYY-MM-DD (mesma base UTC-midnight que `diasEntre` usa). */
function isoOffsetDias(baseISO: string, deltaDias: number): string {
  return new Date(Date.parse(`${baseISO}T00:00:00Z`) + deltaDias * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/**
 * E6 — testa a §4 (Pagamentos) do cockpit E1 acendendo via lerPagamentosResumo:
 *  - tabela hub_obra_pagamentos AUSENTE → temFinanceiro=false, pagamentosAVencer=null (degrada, não quebra);
 *  - tabela PRESENTE → temFinanceiro=true + baldes derivados + campo aditivo `financeiro`;
 *  - tenant scoping: todo SELECT recebe `.eq("tenant_id", <tenant da sessão>)`.
 *
 * Mock encadeável roteado por tabela. Cada `.eq("tenant_id", v)` é registrado p/ assertar o escopo.
 */

const TENANT = "00000000-0000-4000-8000-000000000001";
const RELATION_MISSING = { message: 'relation "public.hub_obra_pagamentos" does not exist' };

type Rows = Record<string, unknown>[];

function makeSupabase(opts: {
  obras: Rows;
  pagamentos?: Rows;
  pagamentosError?: { message: string } | null;
}) {
  const tenantFiltros: { tabela: string; tenant: unknown }[] = [];

  function builder(tabela: string) {
    const state: { rows: Rows; error: { message: string } | null } = (() => {
      if (tabela === "hub_obras") return { rows: opts.obras, error: null };
      if (tabela === "hub_obra_pagamentos")
        return { rows: opts.pagamentos ?? [], error: opts.pagamentosError ?? null };
      // demais tabelas (cronograma/ocorrencias/pedidos) → vazias, sem erro
      return { rows: [], error: null };
    })();

    const q: Record<string, unknown> = {};
    q.select = () => q;
    q.eq = (col: string, val: unknown) => {
      if (col === "tenant_id") tenantFiltros.push({ tabela, tenant: val });
      return q;
    };
    q.in = () => q;
    q.order = () => q;
    q.limit = () => Promise.resolve({ data: state.rows, error: state.error });
    // hub_obras usa .order().limit() e devolve via await da query; resolvemos no limit.
    return q;
  }

  const client = { from: (tabela: string) => builder(tabela) };
  return { supabase: client as unknown as SupabaseClient, tenantFiltros };
}

const OBRA = { id: "o1", codigo: "OB-1", titulo: "Consulado", status: "ativa", cidade: "SP", estado: "SP" };

describe("cockpit E1 §4 — financeiro (E6) degradável + agregado", () => {
  it("tabela de pagamentos AUSENTE → temFinanceiro=false, pagamentosAVencer=null (degrada, não quebra)", async () => {
    const { supabase } = makeSupabase({
      obras: [OBRA],
      pagamentosError: RELATION_MISSING,
    });
    const p = await aggregateCockpit(supabase, TENANT);
    expect(p.flags.temFinanceiro).toBe(false);
    expect(p.contadores.pagamentosAVencer).toBeNull();
    expect(p.contadores.financeiro).toBeUndefined();
    // o resto do cockpit segue vivo
    expect(p.contadores.obras).toBe(1);
  });

  it("tabela presente → temFinanceiro=true + baldes derivados + campo aditivo financeiro", async () => {
    // TZ-robusto: ancora no MESMO "hoje" que a produção (hojeISODate = data LOCAL). Senão,
    // à noite em GMT-3 (UTC já no dia seguinte), o "ontem" em UTC coincide com o "hoje" local
    // e o teste de `atrasado` quebrava — flake só na máquina local, verde no CI (runner UTC).
    const hoje = hojeISODate();
    const ontem = isoOffsetDias(hoje, -1);
    const daqui3 = isoOffsetDias(hoje, 3);
    const daqui30 = isoOffsetDias(hoje, 30);

    const { supabase } = makeSupabase({
      obras: [OBRA],
      pagamentos: [
        { status: "liberado", valor: 32000, valor_retencao: 0, data_vencimento: ontem, escrow_liberado: false },
        { status: "liberado", valor: 84000, valor_retencao: 0, data_vencimento: daqui3, escrow_liberado: false },
        { status: "liberado", valor: 50000, valor_retencao: 0, data_vencimento: daqui30, escrow_liberado: false },
        { status: "em_custodia", valor: 20000, valor_retencao: 0, data_vencimento: daqui30, escrow_liberado: true },
      ],
    });
    const p = await aggregateCockpit(supabase, TENANT);
    expect(p.flags.temFinanceiro).toBe(true);
    const fin = p.contadores.financeiro!;
    expect(fin.atrasado).toBe(32000); // venceu ontem
    expect(fin.vencendo_7d).toBe(84000); // em 3 dias
    // BALDES MUTUAMENTE EXCLUSIVOS (clareza pro gestor): a_pagar = só o liberado de 30d (50k).
    // O em_custodia de 30d (20k) NÃO entra em a_pagar — vai SÓ pro cofre (sem dupla contagem).
    expect(fin.a_pagar).toBe(50000);
    expect(fin.em_custodia).toBe(20000);
    // aguarda 2ª chave = liberados ainda não escrow_liberado (32k + 84k + 50k); o em_custodia já saiu.
    expect(fin.aguarda_2a_chave).toBe(166000);
    // pagamentosAVencer (assinatura preservada) = a_pagar + vencendo + atrasado (sem o em_custodia)
    expect(p.contadores.pagamentosAVencer).toBe(166000);
    expect(hoje).toBe(hoje); // sanity
  });

  it("todo SELECT do cockpit é escopado por tenant (sem vazamento cross-tenant)", async () => {
    const { supabase, tenantFiltros } = makeSupabase({
      obras: [OBRA],
      pagamentos: [],
    });
    await aggregateCockpit(supabase, TENANT);
    // pelo menos obras + pagamentos filtraram por tenant, sempre o tenant da sessão.
    expect(tenantFiltros.length).toBeGreaterThan(0);
    for (const f of tenantFiltros) expect(f.tenant).toBe(TENANT);
    expect(tenantFiltros.some((f) => f.tabela === "hub_obra_pagamentos")).toBe(true);
  });
});
