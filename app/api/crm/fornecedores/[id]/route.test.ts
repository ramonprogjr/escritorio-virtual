import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Foco do CRÍTICO-1: o PATCH /api/crm/fornecedores/[id] agora exige requireCrmGestor,
 * isola por tenant (filtro .or no update) e registra log de auditoria quando
 * `comissao_pct` MUDA (caminho do dinheiro). Espelha o teste do PATCH de parceiro.
 */

// Guarda gestor-only → autorizado por padrão (o caso negado é testado à parte).
const guardMock = vi.fn(async () => ({
  ctx: {
    authId: "auth-1",
    userId: "user-1",
    role: "gestor",
    status: "ativo",
    tenantId: "11111111-1111-4111-8111-111111111111",
  },
}));
vi.mock("@/lib/crm/crm-api-auth", () => ({
  requireCrmGestor: (req: Request) => guardMock(req as never),
}));

// crmConfigError null = configurado; crmDb = cliente fake capturável.
const orFilters: string[] = [];
const logInserts: Record<string, unknown>[] = [];
let fornecedorRetornado: Record<string, unknown> | null = null;
let comissaoAtualNoBanco: number | null = null;

function fakeClient() {
  return {
    from(tabela: string) {
      if (tabela === "hub_fornecedores") {
        const q: Record<string, unknown> = {};
        // leitura prévia da comissão: select(...).eq(...).maybeSingle()
        // update: update(...).eq(...).or(...).select(...).maybeSingle()
        q.select = () => q;
        q.update = () => q;
        q.eq = () => q;
        q.or = (f: string) => {
          orFilters.push(f);
          return q;
        };
        q.maybeSingle = () => {
          // 1ª chamada (leitura prévia) tem .select sem .update → devolve comissão atual.
          // Diferenciamos pelo estado: a leitura prévia acontece antes do update.
          if (!fornecedorRetornadoConsumido && comissaoAtualNoBanco !== null) {
            fornecedorRetornadoConsumido = true;
            return Promise.resolve({ data: { comissao_pct: comissaoAtualNoBanco }, error: null });
          }
          return Promise.resolve({ data: fornecedorRetornado, error: null });
        };
        return q;
      }
      if (tabela === "hub_logs") {
        return {
          insert: (row: Record<string, unknown>) => {
            logInserts.push(row);
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error("tabela inesperada: " + tabela);
    },
  };
}
let fornecedorRetornadoConsumido = false;

vi.mock("@/lib/crm/supabase-server", () => ({
  crmConfigError: () => null,
  crmDb: () => fakeClient(),
}));

// logsAuditoria ON para o log de comissão ser exercido.
vi.mock("@/lib/crm/feature-flags", () => ({
  crmFeatureFlags: { logsAuditoria: () => true },
}));

import { PATCH } from "./route";

function reqPatch(body: unknown) {
  return new NextRequest("http://localhost/api/crm/fornecedores/F1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const ctx = { params: Promise.resolve({ id: "F1" }) };

describe("PATCH /api/crm/fornecedores/[id] — auth + tenant + auditoria de comissão", () => {
  beforeEach(() => {
    orFilters.length = 0;
    logInserts.length = 0;
    fornecedorRetornadoConsumido = false;
    comissaoAtualNoBanco = null;
    fornecedorRetornado = { id: "F1", nome: "Fornecedor 1", comissao_pct: 10, tenant_id: "11111111-1111-4111-8111-111111111111" };
    guardMock.mockImplementation(async () => ({
      ctx: { authId: "auth-1", userId: "user-1", role: "gestor", status: "ativo", tenantId: "11111111-1111-4111-8111-111111111111" },
    }));
  });
  afterEach(() => vi.clearAllMocks());

  it("guarda negada → propaga o erro da guarda (sem tocar o banco)", async () => {
    const { NextResponse } = await import("next/server");
    guardMock.mockImplementationOnce(async () => ({ error: NextResponse.json({ error: "nao" }, { status: 403 }) }));
    const res = await PATCH(reqPatch({ comissao_pct: 20 }), ctx);
    expect(res.status).toBe(403);
  });

  it("update é escopado por tenant (filtro .or com o tenant da sessão)", async () => {
    const res = await PATCH(reqPatch({ nome: "Novo Nome" }), ctx);
    expect(res.status).toBe(200);
    // o filtro de tenant foi aplicado ao update
    expect(orFilters.some((f) => f.includes("11111111-1111-4111-8111-111111111111"))).toBe(true);
  });

  it("registra log de auditoria quando comissao_pct MUDA (10 → 20)", async () => {
    comissaoAtualNoBanco = 10;
    fornecedorRetornado = { id: "F1", nome: "Fornecedor 1", comissao_pct: 20, tenant_id: "11111111-1111-4111-8111-111111111111" };
    const res = await PATCH(reqPatch({ comissao_pct: 20 }), ctx);
    expect(res.status).toBe(200);
    expect(logInserts).toHaveLength(1);
    expect(logInserts[0].acao).toBe("comissao_alterada");
    expect(logInserts[0].valor_anterior).toBe("10");
    expect(logInserts[0].valor_novo).toBe("20");
    expect(logInserts[0].entidade).toBe("fornecedor");
  });

  it("NÃO registra log quando comissao_pct não foi enviada", async () => {
    const res = await PATCH(reqPatch({ nome: "Só nome" }), ctx);
    expect(res.status).toBe(200);
    expect(logInserts).toHaveLength(0);
  });

  it("update sem linha (fora do tenant / inexistente) → 404", async () => {
    fornecedorRetornado = null;
    const res = await PATCH(reqPatch({ nome: "X" }), ctx);
    expect(res.status).toBe(404);
  });
});
