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
type InsertCall = { tabela: string; linha: Record<string, unknown> };

const rpcCalls: RpcCall[] = [];
const insertCalls: InsertCall[] = [];
let aprovacaoRow: Record<string, unknown> | null = null;
// F-B3: quando true, o SELECT-single ACHA a linha (existe), mas o UPDATE condicionado a
// status='pendente' retorna data=[] — i.e. a aprovação JÁ foi processada (2º clique / outro operador).
// Desacopla o resultado do UPDATE do resultado da leitura para reproduzir a corrida exata.
let updateRetornaVazio = false;
// Quando true, rpc_snapshot_custo_frente devolve "function does not exist" (migração E7b pendente).
let snapshotFuncaoAusente = false;
// Quando set, rpc_snapshot_custo_frente devolve um erro REAL (não "função ausente") — deve ser logado.
let snapshotErroReal: { code?: string; message?: string } | null = null;
// Quando true, rpc_snapshot_custo_frente LANÇA exceção (falha de rede) — também deve ser logado.
let snapshotLancaExcecao = false;

function makeQuery(tabela: string) {
  // Builder encadeável. Os terminais (single, select-como-terminal, insert) resolvem Promises.
  // IMPORTANTE para F-B3: após .update().eq().eq().eq().select("id"), a lib aguarda
  // { data: [...], error } para checar se linhas foram afetadas (guarda de idempotência).
  // O mock devolve data=[aprovacaoRow] se aprovacaoRow != null (UPDATE teve efeito),
  // ou data=[] se null (UPDATE sem efeito — idempotência já processada).
  let isUpdate = false;
  const q: Record<string, unknown> = {};
  q.update = () => { isUpdate = true; return q; };
  q.select = (..._args: unknown[]) => {
    if (isUpdate) {
      // Terminal do update: retorna as linhas afetadas (F-B3 idempotência). updateRetornaVazio
      // força data=[] mesmo com a linha existindo (2º clique: o guard status='pendente' não casa).
      return Promise.resolve({
        data: aprovacaoRow && !updateRetornaVazio ? [{ id: aprovacaoRow.id }] : [],
        error: null,
      });
    }
    // select de leitura — encadeável (ex: .from().select().eq().single())
    return q;
  };
  q.insert = (linha: Record<string, unknown>) => {
    insertCalls.push({ tabela, linha });
    return Promise.resolve({ data: null, error: null });
  };
  q.eq = () => q;
  q.single = () => Promise.resolve({ data: aprovacaoRow, error: null });
  return q;
}

const fakeClient = {
  from: (tabela: string) => makeQuery(tabela),
  rpc: (nome: string, args: Record<string, unknown>) => {
    rpcCalls.push({ nome, args });
    if (nome === "rpc_snapshot_custo_frente") {
      // E7c: simula a função de snapshot ainda não migrada (E7b pendente) → erro tolerado, NÃO logado.
      if (snapshotFuncaoAusente) {
        return Promise.resolve({
          data: null,
          error: { code: "42883", message: "function rpc_snapshot_custo_frente(uuid, uuid, uuid) does not exist" },
        });
      }
      // AUT-1/SEC-8: exceção de rede → o catch loga a falha de reconciliação.
      if (snapshotLancaExcecao) {
        return Promise.reject(new Error("network down"));
      }
      // AUT-1/SEC-8: erro REAL (não "função ausente") → deve ser logado p/ reconciliação.
      if (snapshotErroReal) {
        return Promise.resolve({ data: null, error: snapshotErroReal });
      }
    }
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
  insertCalls.length = 0;
  aprovacaoRow = null;
  updateRetornaVazio = false;
  snapshotFuncaoAusente = false;
  snapshotErroReal = null;
  snapshotLancaExcecao = false;
  // Garante que supabase() encontra as envs (createClient é mockado, mas o ! exige string).
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
});

/** Helper: linhas inseridas em hub_decision_logs (o log de decisões/reconciliação). */
function decisionLogs(): Record<string, unknown>[] {
  return insertCalls.filter((c) => c.tabela === "hub_decision_logs").map((c) => c.linha);
}

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

  // ── E7c (Fase 3a — decisão #1): o snapshot de custo dispara APÓS aprovar o orçamento da frente ──
  it("aprovar o orçamento → chama rpc_snapshot_custo_frente (DEPOIS do Gate 1) com obra+frente+tenant", async () => {
    aprovacaoRow = {
      id: "apr-orc-2",
      tipo: "orcamento_frente",
      agente_slug: "hub",
      descricao: "Aprovar orçamento",
      dados: { orcamento_id: "orc-77", obra_id: "obra-9", frente_id: "frente-3" },
    };

    const r = await aprovar("apr-orc-2", undefined, TENANT);
    expect(r.sucesso).toBe(true);

    const snap = rpcCalls.filter((c) => c.nome === "rpc_snapshot_custo_frente");
    expect(snap).toHaveLength(1);
    expect(snap[0].args).toMatchObject({
      p_obra_id: "obra-9",
      p_frente_id: "frente-3",
      p_tenant_id: TENANT,
    });
    // Ordem: aprovação ANTES do snapshot (o snapshot lê o que já está aprovado).
    const idxAprovar = rpcCalls.findIndex((c) => c.nome === "rpc_aprovar_orcamento_frente");
    const idxSnap = rpcCalls.findIndex((c) => c.nome === "rpc_snapshot_custo_frente");
    expect(idxAprovar).toBeLessThan(idxSnap);
  });

  it("sem frente_id no card → snapshot dispara com p_frente_id null (todas as frentes da obra)", async () => {
    aprovacaoRow = {
      id: "apr-orc-3",
      tipo: "orcamento_frente",
      agente_slug: "hub",
      descricao: "Aprovar orçamento",
      dados: { orcamento_id: "orc-88", obra_id: "obra-10" },
    };
    await aprovar("apr-orc-3", undefined, TENANT);
    const snap = rpcCalls.find((c) => c.nome === "rpc_snapshot_custo_frente");
    expect(snap?.args.p_frente_id).toBeNull();
  });

  it("TOLERÂNCIA: snapshot 'function does not exist' (E7b pendente) → aprovação NÃO quebra", async () => {
    snapshotFuncaoAusente = true;
    aprovacaoRow = {
      id: "apr-orc-4",
      tipo: "orcamento_frente",
      agente_slug: "hub",
      descricao: "Aprovar orçamento",
      dados: { orcamento_id: "orc-99", obra_id: "obra-11", frente_id: "frente-1" },
    };

    const r = await aprovar("apr-orc-4", undefined, TENANT);
    // A aprovação continua bem-sucedida mesmo com o snapshot ausente (best-effort).
    expect(r.sucesso).toBe(true);
    // O Gate 1 rodou; o snapshot foi TENTADO (e o erro foi engolido).
    expect(rpcCalls.some((c) => c.nome === "rpc_aprovar_orcamento_frente")).toBe(true);
    expect(rpcCalls.some((c) => c.nome === "rpc_snapshot_custo_frente")).toBe(true);
  });

  it("sem obra_id no card → snapshot NÃO é chamado (sem alvo), mas o Gate 1 roda", async () => {
    aprovacaoRow = {
      id: "apr-orc-5",
      tipo: "orcamento_frente",
      agente_slug: "hub",
      descricao: "Aprovar orçamento",
      dados: { orcamento_id: "orc-100" }, // sem obra_id
    };
    const r = await aprovar("apr-orc-5", undefined, TENANT);
    expect(r.sucesso).toBe(true);
    expect(rpcCalls.some((c) => c.nome === "rpc_aprovar_orcamento_frente")).toBe(true);
    expect(rpcCalls.some((c) => c.nome === "rpc_snapshot_custo_frente")).toBe(false);
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

  // ── F-B3 IDEMPOTÊNCIA: 2º clique / outro operador NÃO dispara a cascata de novo (pagamento duplicado) ──
  it("F-B3: aprovação já processada (SELECT acha, UPDATE retorna []) → NENHUMA RPC de escrow + sucesso=true", async () => {
    // A linha EXISTE (passa pelo SELECT-single), mas o UPDATE condicionado a status='pendente'
    // não casa nenhuma linha (já 'aprovado' por um clique anterior) → data=[]. A guarda de
    // idempotência deve retornar cedo, ANTES de executarAcaoAprovada, sem liberar o escrow.
    updateRetornaVazio = true;
    aprovacaoRow = {
      id: "apr-arq-idem",
      tipo: "pagamento_obra_arq",
      agente_slug: "hub",
      descricao: "Aprovação da arquitetura (duplo clique)",
      dados: { pagamento_id: "pag-77", obra_id: "obra-7", papel: "arquitetura" },
    };

    const r = await aprovar("apr-arq-idem", undefined, TENANT);
    // Idempotente: o estado desejado já foi atingido → sucesso, mas SEM efeito colateral.
    expect(r.sucesso).toBe(true);
    // A trava exata do F-B3: a cascata de DINHEIRO não roda na 2ª passagem.
    expect(rpcCalls.some((c) => c.nome === "rpc_liberar_escrow")).toBe(false);
    expect(rpcCalls.some((c) => c.nome === "rpc_aprovar_orcamento_frente")).toBe(false);
    expect(rpcCalls.some((c) => c.nome === "rpc_snapshot_custo_frente")).toBe(false);
    expect(rpcCalls).toHaveLength(0);
  });
});

// ── AUT-1 / SEC-8 (integridade financeira): a falha REAL do snapshot de custo é REGISTRADA em
//    hub_decision_logs para reconciliação. A ausência da FUNÇÃO (E7b pendente) continua silenciosa.
describe("AUT-1/SEC-8 — falha do snapshot de custo é logada para reconciliação", () => {
  it("erro REAL do snapshot (não 'função ausente') → grava log de reconciliação com tenant", async () => {
    snapshotErroReal = { code: "P0001", message: "snapshot violou invariante de custo" };
    aprovacaoRow = {
      id: "apr-orc-log-1",
      tipo: "orcamento_frente",
      agente_slug: "hub",
      descricao: "Aprovar orçamento",
      dados: { orcamento_id: "orc-201", obra_id: "obra-20", frente_id: "frente-7" },
    };

    const r = await aprovar("apr-orc-log-1", undefined, TENANT);
    // A aprovação NÃO quebra (best-effort), mas a falha do snapshot deixa rastro.
    expect(r.sucesso).toBe(true);

    const falhas = decisionLogs().filter((l) => l.tipo === "snapshot_custo_falhou");
    expect(falhas).toHaveLength(1);
    expect(falhas[0]).toMatchObject({ tenant_id: TENANT, resultado: "falha_snapshot_custo" });
    expect(String(falhas[0].descricao)).toContain("obra-20");
    expect(String(falhas[0].descricao)).toContain("frente-7");
  });

  it("EXCEÇÃO de rede no snapshot → grava log de reconciliação (não some no catch)", async () => {
    snapshotLancaExcecao = true;
    aprovacaoRow = {
      id: "apr-orc-log-2",
      tipo: "orcamento_frente",
      agente_slug: "hub",
      descricao: "Aprovar orçamento",
      dados: { orcamento_id: "orc-202", obra_id: "obra-21" },
    };

    const r = await aprovar("apr-orc-log-2", undefined, TENANT);
    expect(r.sucesso).toBe(true);
    const falhas = decisionLogs().filter((l) => l.tipo === "snapshot_custo_falhou");
    expect(falhas).toHaveLength(1);
    expect(falhas[0]).toMatchObject({ tenant_id: TENANT });
    // frente "todas" quando o card não traz frente_id.
    expect(String(falhas[0].descricao)).toContain("todas");
  });

  it("'função ausente' (E7b pendente) → NÃO loga falha (estado esperado, não erro)", async () => {
    snapshotFuncaoAusente = true;
    aprovacaoRow = {
      id: "apr-orc-log-3",
      tipo: "orcamento_frente",
      agente_slug: "hub",
      descricao: "Aprovar orçamento",
      dados: { orcamento_id: "orc-203", obra_id: "obra-22", frente_id: "frente-1" },
    };

    const r = await aprovar("apr-orc-log-3", undefined, TENANT);
    expect(r.sucesso).toBe(true);
    expect(decisionLogs().filter((l) => l.tipo === "snapshot_custo_falhou")).toHaveLength(0);
  });

  it("snapshot OK → NÃO loga falha (caminho feliz)", async () => {
    aprovacaoRow = {
      id: "apr-orc-log-4",
      tipo: "orcamento_frente",
      agente_slug: "hub",
      descricao: "Aprovar orçamento",
      dados: { orcamento_id: "orc-204", obra_id: "obra-23", frente_id: "frente-2" },
    };
    const r = await aprovar("apr-orc-log-4", undefined, TENANT);
    expect(r.sucesso).toBe(true);
    expect(decisionLogs().filter((l) => l.tipo === "snapshot_custo_falhou")).toHaveLength(0);
  });
});
