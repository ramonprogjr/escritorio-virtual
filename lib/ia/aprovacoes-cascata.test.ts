import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * C1 (E6 — DINHEIRO): a cascata do gate dourado tem de disparar pelo caminho REAL da UI.
 *
 * Call-graph protegido por este teste:
 *   page.tsx → PATCH /api/hub/aprovacoes/[id] → aprovar(id, obs, tenantId)
 *            → executarAcaoAprovada(aprovacao, tenant) → RPC (rpc_liberar_escrow / rpc_aprovar_orcamento_frente)
 *
 * Antes do fix, executarAcaoAprovada() só tratava 'cotacao_fornecedor' → o humano aprovava, o status
 * virava 'aprovado', mas NENHUM pagamento era liberado e o escrow não movia (gate de teatro).
 *
 * Mock do @supabase/supabase-js: select/update/insert são no-ops encadeáveis; cada .rpc(nome,args) é
 * registrado. Assertamos que aprovar AS 2 CHAVES chama rpc_liberar_escrow com o pagamento + tenant certos.
 */

type RpcCall = { nome: string; args: Record<string, unknown> };

const rpcCalls: RpcCall[] = [];
let aprovacaoRow: Record<string, unknown> | null = null;

function makeQuery() {
  // Builder encadeável: todo método devolve o próprio builder; os terminais resolvem com a aprovação.
  const q: Record<string, unknown> = {};
  q.select = () => q;
  q.update = () => q;
  q.insert = () => Promise.resolve({ data: null, error: null });
  q.eq = () => q;
  q.single = () => Promise.resolve({ data: aprovacaoRow, error: null });
  return q;
}

const fakeClient = {
  from: () => makeQuery(),
  rpc: (nome: string, args: Record<string, unknown>) => {
    rpcCalls.push({ nome, args });
    return Promise.resolve({ data: { ok: true }, error: null });
  },
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => fakeClient,
}));

// Importado DEPOIS do mock (vi.mock é hoisted, mas mantemos a ordem explícita por clareza).
import { aprovar } from "./aprovacoes";

const TENANT = "00000000-0000-4000-8000-000000000001";
const OUTRO_TENANT = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  rpcCalls.length = 0;
  aprovacaoRow = null;
  // Garante que supabase() encontra as envs (createClient é mockado, mas o ! exige string).
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
});

describe("C1 — cascata do escrow dispara pelo caminho real (aprovar → executarAcaoAprovada → RPC)", () => {
  it("aprovar a chave ARQUITETURA do pagamento → chama rpc_liberar_escrow com pagamento + tenant", async () => {
    aprovacaoRow = {
      id: "apr-arq-1",
      tipo: "pagamento_obra_arq",
      agente_slug: "hub",
      descricao: "Aprovação da arquitetura",
      dados: { pagamento_id: "pag-99", obra_id: "obra-7", papel: "arquitetura" },
    };

    const r = await aprovar("apr-arq-1", undefined, TENANT);
    expect(r.sucesso).toBe(true);

    const liberar = rpcCalls.filter((c) => c.nome === "rpc_liberar_escrow");
    expect(liberar).toHaveLength(1);
    expect(liberar[0].args).toMatchObject({
      p_pagamento_id: "pag-99",
      p_tenant_id: TENANT,
    });
  });

  it("aprovar a chave HUB do pagamento → também chama rpc_liberar_escrow (a 2ª chave libera o dinheiro)", async () => {
    aprovacaoRow = {
      id: "apr-hub-1",
      tipo: "pagamento_obra_hub",
      agente_slug: "hub",
      descricao: "Aprovação do Hub",
      dados: { pagamento_id: "pag-99", obra_id: "obra-7", papel: "hub" },
    };

    const r = await aprovar("apr-hub-1", undefined, TENANT);
    expect(r.sucesso).toBe(true);

    const liberar = rpcCalls.filter((c) => c.nome === "rpc_liberar_escrow");
    expect(liberar).toHaveLength(1);
    expect(liberar[0].args).toMatchObject({ p_pagamento_id: "pag-99", p_tenant_id: TENANT });
  });

  it("aprovar o ORÇAMENTO da frente → chama rpc_aprovar_orcamento_frente (Gate 1) com orçamento+aprovação+tenant", async () => {
    aprovacaoRow = {
      id: "apr-orc-1",
      tipo: "orcamento_frente",
      agente_slug: "hub",
      descricao: "Aprovar orçamento",
      dados: { orcamento_id: "orc-42", obra_id: "obra-7" },
    };

    const r = await aprovar("apr-orc-1", undefined, TENANT);
    expect(r.sucesso).toBe(true);

    const gate1 = rpcCalls.filter((c) => c.nome === "rpc_aprovar_orcamento_frente");
    expect(gate1).toHaveLength(1);
    expect(gate1[0].args).toMatchObject({
      p_orcamento_id: "orc-42",
      p_aprovacao_id: "apr-orc-1",
      p_tenant_id: TENANT,
    });
    // Gate 1 nunca toca o escrow diretamente.
    expect(rpcCalls.some((c) => c.nome === "rpc_liberar_escrow")).toBe(false);
  });

  it("a RPC recebe o TENANT DA SESSÃO (não o do dado) — escopo de dinheiro", async () => {
    aprovacaoRow = {
      id: "apr-arq-2",
      tipo: "pagamento_obra_arq",
      agente_slug: "hub",
      descricao: "Aprovação da arquitetura",
      dados: { pagamento_id: "pag-12", obra_id: "obra-1" },
    };

    await aprovar("apr-arq-2", undefined, OUTRO_TENANT);
    const liberar = rpcCalls.find((c) => c.nome === "rpc_liberar_escrow");
    expect(liberar?.args.p_tenant_id).toBe(OUTRO_TENANT);
  });

  it("sem tenant → recusa e NÃO chama nenhuma RPC (fail-closed, dinheiro nunca move sem sessão)", async () => {
    aprovacaoRow = {
      id: "apr-arq-3",
      tipo: "pagamento_obra_arq",
      agente_slug: "hub",
      descricao: "x",
      dados: { pagamento_id: "pag-1", obra_id: "obra-1" },
    };

    const r = await aprovar("apr-arq-3", undefined, "");
    expect(r.sucesso).toBe(false);
    expect(rpcCalls).toHaveLength(0);
  });

  it("aprovação não-financeira (cotacao_fornecedor) NÃO dispara RPC de escrow (sem regressão)", async () => {
    aprovacaoRow = {
      id: "apr-cot-1",
      tipo: "cotacao_fornecedor",
      agente_slug: "compras",
      descricao: "Cotação",
      dados: { pedido_id: "ped-5" },
    };

    const r = await aprovar("apr-cot-1", undefined, TENANT);
    expect(r.sucesso).toBe(true);
    expect(rpcCalls.some((c) => c.nome === "rpc_liberar_escrow")).toBe(false);
    expect(rpcCalls.some((c) => c.nome === "rpc_aprovar_orcamento_frente")).toBe(false);
  });
});
