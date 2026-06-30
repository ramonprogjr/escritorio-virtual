import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * E7c (Fase 3a) — POST /medicoes:
 *  (1) deriva o pct_avanco_resultante da quantidade física e GRAVA no item-mãe (avanço POR ITEM);
 *  (2) TOLERÂNCIA: sem a tabela hub_obra_medicoes (migração E7c pendente), grava SÓ o pct e responde
 *      migracao_pendente=true — nunca quebra;
 *  (3) TENANT GUARD: a obra/item têm de ser do tenant da sessão; nunca aceita tenant_id/obra_id do body.
 *
 * Fakes capturam o payload do .update (item) e do .insert (medição) e podem simular a tabela ausente.
 */

const TENANT = "11111111-1111-4111-8111-111111111111";
const OBRA = "22222222-2222-4222-8222-222222222222";
const ITEM = "33333333-3333-4333-8333-333333333333";

let sessionRole = "gestor";
let obraTenant: string | null = TENANT; // tenant da obra retornada por assertObraDoTenant
let itemRow: Record<string, unknown> | null = { id: ITEM, obra_id: OBRA, tenant_id: TENANT, quantidade: 24, pct_avanco: 0 };
let medicaoTabelaAusente = false;

vi.mock("@/lib/crm/crm-api-auth", () => ({
  requireCrmComercial: vi.fn(async () => ({
    ctx: { authId: "a", userId: "u", role: sessionRole, status: "ativo", tenantId: TENANT },
  })),
  requireCrmSessao: vi.fn(async () => ({
    ctx: { authId: "a", userId: "u", role: sessionRole, status: "ativo", tenantId: TENANT },
  })),
}));

let updatePayloads: Record<string, unknown>[] = [];
let updateFilters: Record<string, unknown>[] = [];
let insertPayloads: Record<string, unknown>[] = [];

function makeItemUpdateChain() {
  const filtros: Record<string, unknown> = {};
  const chain: Record<string, unknown> = {};
  chain.eq = (col: string, val: unknown) => {
    filtros[col] = val;
    return chain;
  };
  // O endpoint chama .eq(...).eq(...).eq(...) e aguarda a promise resolvida (sem .select no update).
  chain.then = (resolve: (v: unknown) => void) => {
    updateFilters.push(filtros);
    resolve({ error: null });
  };
  return chain;
}

function makeMedicaoInsertChain() {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.single = () => {
    if (medicaoTabelaAusente) {
      return Promise.resolve({
        data: null,
        error: { code: "42P01", message: 'relation "hub_obra_medicoes" does not exist' },
      });
    }
    return Promise.resolve({ data: { id: "med-1", item_id: ITEM, pct_avanco_resultante: 50 }, error: null });
  };
  return chain;
}

function fakeClient() {
  return {
    from(tabela: string) {
      if (tabela === "hub_obras") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: obraTenant == null ? null : { id: OBRA, tenant_id: obraTenant },
                  error: null,
                }),
            }),
          }),
        };
      }
      if (tabela === "hub_obra_itens") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: itemRow, error: null }),
            }),
          }),
          update(payload: Record<string, unknown>) {
            updatePayloads.push(payload);
            return makeItemUpdateChain();
          },
        };
      }
      // hub_obra_medicoes
      return {
        insert(payload: Record<string, unknown>) {
          insertPayloads.push(payload);
          return makeMedicaoInsertChain();
        },
      };
    },
  };
}

vi.mock("@/lib/crm/supabase-server", () => ({
  crmConfigError: () => null,
  crmDb: () => fakeClient(),
}));

import { POST } from "./route";

function reqPost(body: unknown) {
  return new NextRequest(`http://localhost/api/crm/obras/${OBRA}/medicoes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const paramsOf = () => ({ params: Promise.resolve({ id: OBRA }) });

beforeEach(() => {
  updatePayloads = [];
  updateFilters = [];
  insertPayloads = [];
  sessionRole = "gestor";
  obraTenant = TENANT;
  itemRow = { id: ITEM, obra_id: OBRA, tenant_id: TENANT, quantidade: 24, pct_avanco: 0 };
  medicaoTabelaAusente = false;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-placeholder";
});
afterEach(() => vi.clearAllMocks());

describe("POST /medicoes — deriva o pct da quantidade e grava no item (avanço POR ITEM)", () => {
  it("12 de 24 → grava pct_avanco 50 no item-mãe e registra a medição", async () => {
    const res = await POST(reqPost({ item_id: ITEM, quantidade_realizada: 12, foto_url: "https://x/p.jpg" }), paramsOf());
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.pct_avanco_resultante).toBe(50);
    expect(json.medicao_registrada).toBe(true);

    // O update do item gravou o pct derivado.
    expect(updatePayloads[0].pct_avanco).toBe(50);
    // A medição append-only carrega o snapshot + tenant da sessão.
    expect(insertPayloads[0].pct_avanco_resultante).toBe(50);
    expect(insertPayloads[0].quantidade_realizada).toBe(12);
  });

  it("sem quantidade planejada → usa o pct informado", async () => {
    itemRow = { id: ITEM, obra_id: OBRA, tenant_id: TENANT, quantidade: null, pct_avanco: 0 };
    const res = await POST(reqPost({ item_id: ITEM, pct_avanco_resultante: 73 }), paramsOf());
    const json = await res.json();
    expect(json.pct_avanco_resultante).toBe(73);
    expect(updatePayloads[0].pct_avanco).toBe(73);
  });

  it("nada utilizável → preserva o pct atual do item (não zera)", async () => {
    itemRow = { id: ITEM, obra_id: OBRA, tenant_id: TENANT, quantidade: null, pct_avanco: 40 };
    const res = await POST(reqPost({ item_id: ITEM, observacao: "só uma nota" }), paramsOf());
    const json = await res.json();
    expect(json.pct_avanco_resultante).toBe(40);
    expect(updatePayloads[0].pct_avanco).toBe(40);
  });
});

describe("POST /medicoes — tolerância (tabela hub_obra_medicoes ausente)", () => {
  it("sem a migração E7c: grava o pct no item, NÃO registra a medição, avisa migracao_pendente", async () => {
    medicaoTabelaAusente = true;
    const res = await POST(reqPost({ item_id: ITEM, quantidade_realizada: 24 }), paramsOf());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.migracao_pendente).toBe(true);
    expect(json.medicao_registrada).toBe(false);
    expect(json.pct_avanco_resultante).toBe(100); // 24/24
    expect(typeof json.aviso).toBe("string");
    // O avanço entrou no item mesmo sem a tabela de medições.
    expect(updatePayloads[0].pct_avanco).toBe(100);
  });
});

describe("POST /medicoes — tenant guard + nunca confia no body", () => {
  it("obra de OUTRO tenant → 404 (não grava nada)", async () => {
    obraTenant = "99999999-9999-4999-8999-999999999999";
    const res = await POST(reqPost({ item_id: ITEM, quantidade_realizada: 5 }), paramsOf());
    expect(res.status).toBe(404);
    expect(updatePayloads.length).toBe(0);
    expect(insertPayloads.length).toBe(0);
  });

  it("item de OUTRA obra/tenant → 404", async () => {
    itemRow = { id: ITEM, obra_id: "outra-obra", tenant_id: TENANT, quantidade: 10, pct_avanco: 0 };
    const res = await POST(reqPost({ item_id: ITEM, quantidade_realizada: 5 }), paramsOf());
    expect(res.status).toBe(404);
    expect(updatePayloads.length).toBe(0);
  });

  it("item_id ausente → 400", async () => {
    const res = await POST(reqPost({ quantidade_realizada: 5 }), paramsOf());
    expect(res.status).toBe(400);
  });

  it("NUNCA aceita tenant_id/obra_id do body — usa a sessão/rota no insert e no filtro", async () => {
    await POST(
      reqPost({
        item_id: ITEM,
        quantidade_realizada: 24,
        tenant_id: "99999999-9999-4999-8999-999999999999",
        obra_id: "outra",
      }),
      paramsOf()
    );
    // O insert da medição leva o tenant/obra da SESSÃO/ROTA, não os do body.
    expect(insertPayloads[0].tenant_id).toBe(TENANT);
    expect(insertPayloads[0].obra_id).toBe(OBRA);
    // O filtro do update do item também.
    expect(updateFilters[0].tenant_id).toBe(TENANT);
    expect(updateFilters[0].obra_id).toBe(OBRA);
    expect(updateFilters[0].id).toBe(ITEM);
  });
});
