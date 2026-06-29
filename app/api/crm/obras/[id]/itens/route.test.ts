import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Bloqueadores 1+2 da auditoria adversarial (Fase 2 / aba Escopo):
 *  (1) o PATCH /itens GRAVA DE VERDADE quantidade + os 4 campos de custo (antes descartava 200 mudo);
 *  (2) a escrita de custo é GATEADA POR PERSONA no SERVIDOR (não confia no cliente esconder o campo);
 *      + tolerância E7 (sem as colunas de custo, a quantidade grava e a resposta avisa honestamente).
 *
 * O `role` da sessão é controlado por teste para exercitar cada persona. O fake do crmDb captura o
 * payload do `.update(...)` e pode simular a coluna E7 ausente no 1º update (retry sem custo).
 */

const TENANT = "11111111-1111-4111-8111-111111111111";
const OBRA = "22222222-2222-4222-8222-222222222222";
const ITEM = "33333333-3333-4333-8333-333333333333";

let sessionRole = "gestor"; // mutável por teste (deriva a persona server-side)

vi.mock("@/lib/crm/crm-api-auth", () => ({
  // PATCH usa requireCrmComercial; devolve o ctx com o role do teste.
  requireCrmComercial: vi.fn(async () => ({
    ctx: { authId: "a", userId: "u", role: sessionRole, status: "ativo", tenantId: TENANT },
  })),
  requireCrmSessao: vi.fn(async () => ({
    ctx: { authId: "a", userId: "u", role: sessionRole, status: "ativo", tenantId: TENANT },
  })),
}));

// Estado capturado/injetado por teste.
let updatePayloads: Record<string, unknown>[] = [];
let updateFilters: Record<string, unknown>[] = [];
let e7AusenteNoPrimeiroUpdate = false;
let updateCount = 0;

function makeUpdateChain() {
  const filtros: Record<string, unknown> = {};
  const chain: Record<string, unknown> = {};
  chain.eq = (col: string, val: unknown) => {
    filtros[col] = val;
    return chain;
  };
  chain.select = () => chain;
  chain.maybeSingle = () => {
    updateCount += 1;
    updateFilters.push(filtros);
    // Simula a coluna E7 ausente SÓ na 1ª tentativa (a que inclui custo).
    if (e7AusenteNoPrimeiroUpdate && updateCount === 1) {
      return Promise.resolve({
        data: null,
        error: { code: "42703", message: 'column "custo_material" does not exist' },
      });
    }
    return Promise.resolve({ data: { id: ITEM, nome: "Item" }, error: null });
  };
  return chain;
}

function fakeClient() {
  return {
    from(tabela: string) {
      if (tabela === "hub_obras") {
        // assertObraDoTenant: select(...).eq("id").maybeSingle()
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { id: OBRA, tenant_id: TENANT }, error: null }),
            }),
          }),
        };
      }
      // hub_obra_itens: update(payload).eq(...).eq(...).eq(...).select(...).maybeSingle()
      return {
        update(payload: Record<string, unknown>) {
          updatePayloads.push(payload);
          return makeUpdateChain();
        },
      };
    },
  };
}

vi.mock("@/lib/crm/supabase-server", () => ({
  crmConfigError: () => null,
  crmDb: () => fakeClient(),
}));

import { PATCH } from "./route";

function reqPatch(body: unknown) {
  return new NextRequest(`http://localhost/api/crm/obras/${OBRA}/itens`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const paramsOf = () => ({ params: Promise.resolve({ id: OBRA }) });

describe("PATCH /api/crm/obras/[id]/itens — grava quantidade + custo (bloqueador 1)", () => {
  beforeEach(() => {
    updatePayloads = [];
    updateFilters = [];
    e7AusenteNoPrimeiroUpdate = false;
    updateCount = 0;
    sessionRole = "gestor"; // persona hub: pode custo
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-placeholder";
  });
  afterEach(() => vi.clearAllMocks());

  it("persiste quantidade E os 4 custos no payload do UPDATE (antes eram descartados)", async () => {
    const res = await PATCH(
      reqPatch({
        id: ITEM,
        quantidade: 17,
        custo_locacao_frete: 10,
        custo_material: 20,
        custo_mao_obra: 20,
        bdi_fator: 1.06,
      }),
      paramsOf()
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.custo_gravado).toBe(true);
    expect(json.migracao_pendente).toBe(false);

    const p = updatePayloads[0];
    expect(p.quantidade).toBe(17);
    expect(p.custo_locacao_frete).toBe(10);
    expect(p.custo_material).toBe(20);
    expect(p.custo_mao_obra).toBe(20);
    expect(p.bdi_fator).toBe(1.06);
  });

  it("quantidade 0 é VÁLIDA (item zerado) — grava 0, não null", async () => {
    await PATCH(reqPatch({ id: ITEM, quantidade: 0 }), paramsOf());
    expect(updatePayloads[0].quantidade).toBe(0);
  });

  it("NUNCA aceita tenant_id/obra_id/id do body no payload (filtro .eq garante posse)", async () => {
    await PATCH(
      reqPatch({ id: ITEM, quantidade: 5, tenant_id: "99999999-9999-4999-8999-999999999999", obra_id: "outra" }),
      paramsOf()
    );
    const p = updatePayloads[0];
    expect(p.tenant_id).toBeUndefined();
    expect(p.obra_id).toBeUndefined();
    expect(p.id).toBeUndefined();
    // E o filtro usa o tenant da SESSÃO, não o do body.
    expect(updateFilters[0].tenant_id).toBe(TENANT);
    expect(updateFilters[0].obra_id).toBe(OBRA);
    expect(updateFilters[0].id).toBe(ITEM);
  });
});

describe("PATCH /itens — gate de persona no SERVIDOR (bloqueador 2)", () => {
  beforeEach(() => {
    updatePayloads = [];
    updateFilters = [];
    e7AusenteNoPrimeiroUpdate = false;
    updateCount = 0;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-placeholder";
  });
  afterEach(() => vi.clearAllMocks());

  it("parceiro (prestador): custo é REJEITADO no servidor mesmo enviado no body; quantidade grava", async () => {
    sessionRole = "parceiro";
    const res = await PATCH(
      reqPatch({ id: ITEM, quantidade: 7, custo_material: 500, custo_mao_obra: 300 }),
      paramsOf()
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.custo_ignorado_persona).toBe(true);
    expect(json.custo_gravado).toBe(false);

    const p = updatePayloads[0];
    expect(p.quantidade).toBe(7); // quantidade passa
    expect(p.custo_material).toBeUndefined(); // custo NÃO entrou no UPDATE
    expect(p.custo_mao_obra).toBeUndefined();
  });

  it("executor (comercial): custo é aceito e gravado", async () => {
    sessionRole = "comercial";
    const res = await PATCH(reqPatch({ id: ITEM, quantidade: 2, custo_material: 100 }), paramsOf());
    const json = await res.json();
    expect(json.custo_gravado).toBe(true);
    expect(updatePayloads[0].custo_material).toBe(100);
  });
});

describe("PATCH /itens — tolerância E7 (coluna de custo ausente)", () => {
  beforeEach(() => {
    updatePayloads = [];
    updateFilters = [];
    e7AusenteNoPrimeiroUpdate = true; // 1º update falha por coluna ausente
    updateCount = 0;
    sessionRole = "gestor";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-placeholder";
  });
  afterEach(() => vi.clearAllMocks());

  it("sem as colunas E7: retry sem custo — quantidade grava, resposta avisa migracao_pendente (não mente)", async () => {
    const res = await PATCH(
      reqPatch({ id: ITEM, quantidade: 9, custo_material: 50 }),
      paramsOf()
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.migracao_pendente).toBe(true);
    expect(json.custo_gravado).toBe(false);
    expect(typeof json.aviso).toBe("string");

    // 1ª tentativa (com custo) falhou; 2ª (só patch) gravou a quantidade.
    expect(updatePayloads.length).toBe(2);
    expect(updatePayloads[0].custo_material).toBe(50); // tentou com custo
    expect(updatePayloads[1].custo_material).toBeUndefined(); // retry sem custo
    expect(updatePayloads[1].quantidade).toBe(9); // quantidade gravou
  });
});
