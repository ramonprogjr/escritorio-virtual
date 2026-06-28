import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Foco do CRÍTICO-4: o POST /api/crm/financeiro/contas, ao receber um negocio_id, faz
 * SELECT-first em hub_contas_receber — se já existe recebível para aquele negócio, retorna
 * o existente (ja_existia:true) em vez de inserir outro. Sem negocio_id, segue inserindo.
 */

vi.mock("@/lib/crm/crm-api-auth", () => ({
  requireCrmFinanceiro: vi.fn(async () => ({
    ctx: {
      authId: "auth-1",
      userId: "user-1",
      role: "financeiro",
      status: "ativo",
      tenantId: "11111111-1111-4111-8111-111111111111",
    },
  })),
}));

const inserts: Record<string, unknown[]> = {};
let recebivelExistente: { id: string } | null = null;

function fakeClient() {
  return {
    from(tabela: string) {
      return {
        // SELECT-first: select(...).eq(...).or(...).limit(...).maybeSingle()
        select() {
          const q: Record<string, unknown> = {};
          q.eq = () => q;
          q.or = () => q;
          q.limit = () => q;
          q.maybeSingle = () => Promise.resolve({ data: recebivelExistente, error: null });
          // insert(...).select(...).single() é tratado abaixo
          return q;
        },
        insert(payload: unknown) {
          inserts[tabela] = inserts[tabela] ?? [];
          inserts[tabela].push(payload);
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { id: "novo-id" }, error: null }),
            }),
          };
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

const NEGOCIO = "22222222-2222-4222-8222-222222222222";

function reqPost(body: unknown) {
  return new NextRequest("http://localhost/api/crm/financeiro/contas", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/crm/financeiro/contas — anti-duplicação de recebível por negócio", () => {
  beforeEach(() => {
    for (const k of Object.keys(inserts)) delete inserts[k];
    recebivelExistente = null;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-placeholder";
  });
  afterEach(() => vi.clearAllMocks());

  it("já existe recebível para o negócio → retorna o existente, NÃO insere outro", async () => {
    recebivelExistente = { id: "rec-existente" };
    const res = await POST(reqPost({ tipo: "receber", descricao: "Venda X", valor: 1000, negocio_id: NEGOCIO }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ja_existia).toBe(true);
    expect(json.id).toBe("rec-existente");
    expect(inserts.hub_contas_receber).toBeUndefined();
  });

  it("não existe recebível para o negócio → insere normalmente (201)", async () => {
    recebivelExistente = null;
    const res = await POST(reqPost({ tipo: "receber", descricao: "Venda Y", valor: 500, negocio_id: NEGOCIO }));
    expect(res.status).toBe(201);
    expect(inserts.hub_contas_receber).toHaveLength(1);
  });

  it("sem negocio_id → não faz SELECT-first, insere direto", async () => {
    const res = await POST(reqPost({ tipo: "receber", descricao: "Avulso", valor: 200 }));
    expect(res.status).toBe(201);
    expect(inserts.hub_contas_receber).toHaveLength(1);
  });
});
