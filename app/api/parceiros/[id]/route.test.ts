import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Foco: o PATCH /api/parceiros/[id], DEPOIS de atualizar hub_parceiros com sucesso,
 * faz um UPSERT best-effort no espelho hub_fornecedores (sync parceiro→fornecedor),
 * e esse sync NUNCA derruba o PATCH.
 *
 * Estratégia: mockar a guarda (requireCrmGestor) e o supabase-js (createClient) para
 * capturar as chamadas por tabela. O update de hub_parceiros resolve com o parceiro;
 * o upsert de hub_fornecedores é capturado; o insert de log é engolido.
 */

// Guarda gestor-only → autorizado (não é o foco aqui).
vi.mock("@/lib/crm/crm-api-auth", () => ({
  requireCrmGestor: vi.fn(async () => ({
    ctx: {
      authId: "auth-1",
      userId: "user-1",
      role: "gestor",
      status: "ativo",
      tenantId: "11111111-1111-4111-8111-111111111111",
    },
  })),
}));

// Captura de chamadas ao Supabase, por tabela.
type UpsertCall = { row: Record<string, unknown>; opts?: unknown };
const upsertsFornecedores: UpsertCall[] = [];
let upsertDeveFalhar = false;
let parceiroRetornado: Record<string, unknown> | null = {
  id: "P1",
  nome: "Parceiro 1",
  telefone: "11999",
  mercado: "ARQ",
  especialidade: null,
  cidade: "São Paulo",
  estado: "SP",
  recebe_leads: true,
  status: "homologado",
  total_leads_recebidos: 3,
  status_financeiro: "em_dia",
  tenant_id: "11111111-1111-4111-8111-111111111111",
};

function fakeClient() {
  return {
    from(tabela: string) {
      if (tabela === "hub_parceiros") {
        // update(...).eq(...).or(...).select(...).maybeSingle()
        const q: Record<string, unknown> = {};
        q.update = () => q;
        q.eq = () => q;
        q.or = () => q;
        q.select = () => q;
        q.maybeSingle = () => Promise.resolve({ data: parceiroRetornado, error: null });
        return q;
      }
      if (tabela === "hub_fornecedores") {
        return {
          upsert: (row: Record<string, unknown>, opts?: unknown) => {
            upsertsFornecedores.push({ row, opts });
            return Promise.resolve({
              error: upsertDeveFalhar ? { message: "upsert boom" } : null,
            });
          },
        };
      }
      if (tabela === "hub_parceiros_log") {
        // insert(...).then(ok, err) — Promise-like com .then
        return {
          insert: () => ({
            then: (ok: () => void) => {
              ok();
              return Promise.resolve();
            },
          }),
        };
      }
      throw new Error("tabela inesperada: " + tabela);
    },
  };
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => fakeClient()),
}));

// Importa a rota DEPOIS dos mocks.
import { PATCH } from "./route";

function reqPatch(body: unknown) {
  return new NextRequest("http://localhost/api/parceiros/P1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ctx = { params: Promise.resolve({ id: "P1" }) };

describe("PATCH /api/parceiros/[id] — sync best-effort parceiro → hub_fornecedores", () => {
  beforeEach(() => {
    upsertsFornecedores.length = 0;
    upsertDeveFalhar = false;
    parceiroRetornado = {
      id: "P1",
      nome: "Parceiro 1",
      telefone: "11999",
      mercado: "ARQ",
      especialidade: null,
      cidade: "São Paulo",
      estado: "SP",
      recebe_leads: true,
      status: "homologado",
      total_leads_recebidos: 3,
      status_financeiro: "em_dia",
      tenant_id: "11111111-1111-4111-8111-111111111111",
    };
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-placeholder";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("após update OK, chama upsert em hub_fornecedores com o shape do mapa", async () => {
    const res = await PATCH(reqPatch({ status: "homologado" }), ctx);
    expect(res.status).toBe(200);

    expect(upsertsFornecedores).toHaveLength(1);
    const { row, opts } = upsertsFornecedores[0];
    // id e origem_parceiro_id = id do parceiro (idempotente, onConflict id)
    expect(row.id).toBe("P1");
    expect(row.origem_parceiro_id).toBe("P1");
    expect(opts).toEqual({ onConflict: "id" });
    // contrato puro: mercado "ARQ" → mercados[] + principal; homologado → aprovado
    expect(row.mercados).toEqual(["ARQ"]);
    expect(row.mercado_principal).toBe("ARQ");
    expect(row.status).toBe("homologado");
    expect(row.status_acesso).toBe("aprovado");
    expect(row.recebe_leads).toBe(true);
    // tenant + campos do parceiro propagados
    expect(row.tenant_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(row.total_leads_recebidos).toBe(3);
    expect(row.status_financeiro).toBe("em_dia");
  });

  it("menor privilégio: status não-homologado → status_acesso pendente no espelho", async () => {
    parceiroRetornado = { ...parceiroRetornado, status: "em_homologacao" };
    const res = await PATCH(reqPatch({ status: "em_homologacao" }), ctx);
    expect(res.status).toBe(200);

    expect(upsertsFornecedores).toHaveLength(1);
    expect(upsertsFornecedores[0].row.status).toBe("em_homologacao");
    expect(upsertsFornecedores[0].row.status_acesso).toBe("pendente");
  });

  it("falha no upsert do espelho NÃO derruba o PATCH (best-effort)", async () => {
    upsertDeveFalhar = true;
    const res = await PATCH(reqPatch({ recebe_leads: false }), ctx);
    // PATCH continua 200 mesmo com o espelho falhando
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.parceiro?.id).toBe("P1");
    // ainda tentou sincronizar
    expect(upsertsFornecedores).toHaveLength(1);
  });

  it("parceiro não encontrado (update sem linha) → 404 e NÃO sincroniza espelho", async () => {
    parceiroRetornado = null;
    const res = await PATCH(reqPatch({ recebe_leads: true }), ctx);
    expect(res.status).toBe(404);
    expect(upsertsFornecedores).toHaveLength(0); // sem update, sem sync
  });
});
