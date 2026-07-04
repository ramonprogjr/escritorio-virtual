import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Contrato de segurança do POST /api/crm/parceiros (cadastro MANUAL guardado):
 * guard requireCrmComercial, tenant SEMPRE da sessão, comissao_pct travada no server,
 * feito_por da sessão (não forjável), dedup tenant-scoped com 409 genérico (sem
 * id/código/nome), 23505 global unificado ao mesmo 409 (sem oráculo de tenant), e
 * resposta de sucesso enxuta. Mocka a guarda, o crmDb (só o dedup usa) e o compat
 * (captura a row/log e devolve o resultado configurado).
 */

const TENANT = "11111111-1111-4111-8111-111111111111";

let guardResult: unknown;
let dedupExiste = false; // existeNoTenant → há duplicado no tenant?
let insertResult: { data: unknown; error: unknown };
let capturedRow: Record<string, unknown> | null = null;
let capturedLog: Record<string, unknown> | null = null;

vi.mock("@/lib/crm/crm-api-auth", () => ({
  requireCrmComercial: vi.fn(async () => guardResult),
}));

vi.mock("@/lib/crm/supabase-server", () => ({
  crmConfigError: () => null,
  crmDb: () => ({
    from: (t: string) => {
      if (t !== "hub_parceiros") throw new Error("tabela inesperada: " + t);
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.eq = () => q;
      q.maybeSingle = () => Promise.resolve({ data: dedupExiste ? { id: "dup" } : null, error: null });
      return q;
    },
  }),
}));

vi.mock("@/lib/crm/parceiro-cadastro", () => ({
  gerarCodigoParceiro: vi.fn(async () => "PR2026001"),
}));

vi.mock("@/lib/crm/parceiro-compat", () => ({
  insertParceiroCompat: vi.fn(async (_db: unknown, row: Record<string, unknown>, tenantId: string) => {
    capturedRow = { ...row, __tenant: tenantId };
    return insertResult;
  }),
  insertParceiroCaptacaoCompat: vi.fn(async () => null),
  insertParceiroLogCompat: vi.fn(async (_db: unknown, log: Record<string, unknown>) => {
    capturedLog = log;
    return null;
  }),
}));

import { POST } from "./route";

function req(body: unknown) {
  return new NextRequest("http://localhost/api/crm/parceiros", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ctxOk = {
  ctx: { authId: "a", userId: "user-9", role: "comercial", status: "ativo", tenantId: TENANT, ehHumano: true },
};

describe("POST /api/crm/parceiros — cadastro manual guardado", () => {
  beforeEach(() => {
    guardResult = ctxOk;
    dedupExiste = false;
    insertResult = { data: { id: "P1", codigo: "PR2026001", nome: "X" }, error: null };
    capturedRow = null;
    capturedLog = null;
  });
  afterEach(() => vi.clearAllMocks());

  it("guarda negada → propaga 403 e NÃO insere", async () => {
    const { NextResponse } = await import("next/server");
    guardResult = { error: NextResponse.json({ error: "nao" }, { status: 403 }) };
    const res = await POST(req({ nome: "Fulano", telefone: "11999998888" }));
    expect(res.status).toBe(403);
    expect(capturedRow).toBeNull();
  });

  it("nome vazio → 400", async () => {
    const res = await POST(req({ nome: "  ", telefone: "11999998888" }));
    expect(res.status).toBe(400);
  });

  it("telefone com menos de 10 dígitos → 400", async () => {
    const res = await POST(req({ nome: "Fulano", telefone: "119" }));
    expect(res.status).toBe(400);
  });

  it("comissao_pct do BODY é IGNORADA (travada no server = 5)", async () => {
    const res = await POST(req({ nome: "Fulano", telefone: "11999998888", comissao_pct: 99 }));
    expect(res.status).toBe(201);
    expect(capturedRow?.comissao_pct).toBe(5);
  });

  it("tenant, status e feito_por vêm da SESSÃO (não do body)", async () => {
    const res = await POST(
      req({ nome: "Fulano", telefone: "11999998888", tenant_id: "hacker", feito_por: "hacker", cadastrado_por: "hacker" })
    );
    expect(res.status).toBe(201);
    expect(capturedRow?.__tenant).toBe(TENANT);
    expect(capturedRow?.status).toBe("captacao");
    expect(capturedLog?.feito_por).toBe("user-9");
    expect((capturedLog?.dados as Record<string, unknown>)?.cadastrado_por).toBe("user-9");
  });

  it("dedup tenant-scoped de CPF → 409 genérico sem vazar id/código/nome", async () => {
    dedupExiste = true;
    const res = await POST(req({ nome: "Fulano", telefone: "11999998888", cpf: "390.533.447-05" }));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("Já existe um parceiro com este CPF na rede.");
    expect(json.parceiro_id).toBeUndefined();
    expect(json.codigo).toBeUndefined();
    expect(capturedRow).toBeNull();
  });

  it("UNIQUE global (23505) → MESMO 409 do dedup (sem oráculo de fronteira de tenant)", async () => {
    insertResult = {
      data: null,
      error: { code: "23505", message: 'duplicate key value violates unique constraint "hub_parceiros_cpf_key"' },
    };
    const res = await POST(req({ nome: "Fulano", telefone: "11999998888", cpf: "39053344705" }));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("Já existe um parceiro com este CPF na rede.");
  });

  it("sucesso → 201 devolve só {data:{id,codigo,nome}} (nome da requisição)", async () => {
    const res = await POST(req({ nome: "Novo Parceiro", telefone: "11999998888" }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data).toEqual({ id: "P1", codigo: "PR2026001", nome: "Novo Parceiro" });
    expect(capturedRow?.comissao_pct).toBe(5);
    expect(capturedRow?.__tenant).toBe(TENANT);
  });
});
