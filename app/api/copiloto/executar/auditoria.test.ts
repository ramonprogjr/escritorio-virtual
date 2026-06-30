import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * SEC-7 — auditoria das tools de ESCRITA da IA (copiloto). O endpoint /api/copiloto/executar é o
 * ÚNICO caminho de escrita do copiloto; após executar uma escrita, grava QUEM/QUAL/QUANDO/tenant em
 * hub_decision_logs. Este teste cobre o helper isolado (auditarEscritaCopiloto), no mesmo estilo do
 * webhookAutenticado de whatsapp/webhook (unidade testável exportada da rota).
 *
 * Garantias travadas:
 *  - grava tenant_id SEMPRE (log de ação de IA não nasce órfão — service_role bypassa RLS);
 *  - TOLERÂNCIA: se a coluna tenant_id ainda não existe (E7 pendente), repete o INSERT sem ela;
 *  - registra sucesso e falha; nunca lança (best-effort).
 */

type InsertCall = { tabela: string; linha: Record<string, unknown> };

const insertCalls: InsertCall[] = [];
// Quando true, o 1º insert (com tenant_id) devolve "coluna tenant_id ausente" (E7 pendente).
let tenantColunaAusente = false;

function makeQuery(tabela: string) {
  const q: Record<string, unknown> = {};
  q.insert = (linha: Record<string, unknown>) => {
    insertCalls.push({ tabela, linha });
    if (tenantColunaAusente && "tenant_id" in linha) {
      // PGRST204 + menção à coluna = isMissingPgColumn(error, "tenant_id") === true.
      return Promise.resolve({
        data: null,
        error: { code: "PGRST204", message: "Could not find the 'tenant_id' column of 'hub_decision_logs'" },
      });
    }
    return Promise.resolve({ data: null, error: null });
  };
  return q;
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: (tabela: string) => makeQuery(tabela) }),
}));

import { auditarEscritaCopiloto } from "./route";

const TENANT = "00000000-0000-4000-8000-000000000001";

beforeEach(() => {
  insertCalls.length = 0;
  tenantColunaAusente = false;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
});

function logs() {
  return insertCalls.filter((c) => c.tabela === "hub_decision_logs").map((c) => c.linha);
}

describe("SEC-7 — auditarEscritaCopiloto", () => {
  it("grava um log de escrita com tenant_id, ferramenta e resultado 'executado'", async () => {
    await auditarEscritaCopiloto(TENANT, "hub_obra_item_avanco", "lead-1", true);
    const l = logs();
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({
      tenant_id: TENANT,
      tipo: "ferramenta_ia_escrita",
      resultado: "executado",
      lead_id: "lead-1",
    });
    expect(String(l[0].descricao)).toContain("hub_obra_item_avanco");
  });

  it("escrita SEM lead (obra/EAP) grava lead_id null", async () => {
    await auditarEscritaCopiloto(TENANT, "hub_obra_criar", "", true);
    const l = logs();
    expect(l).toHaveLength(1);
    expect(l[0].lead_id).toBeNull();
  });

  it("falha de execução grava resultado 'falhou'", async () => {
    await auditarEscritaCopiloto(TENANT, "arq_gerar_obra", "", false);
    expect(logs()[0]).toMatchObject({ resultado: "falhou" });
  });

  it("TOLERÂNCIA: coluna tenant_id ausente (E7 pendente) → repete o INSERT SEM tenant_id", async () => {
    tenantColunaAusente = true;
    await auditarEscritaCopiloto(TENANT, "hub_obra_sc_criar", "", true);
    const l = logs();
    // 2 tentativas: a 1ª com tenant_id (falhou), a 2ª sem (degrade honesto).
    expect(l).toHaveLength(2);
    expect(l[0]).toHaveProperty("tenant_id");
    expect(l[1]).not.toHaveProperty("tenant_id");
    expect(l[1]).toMatchObject({ tipo: "ferramenta_ia_escrita", resultado: "executado" });
  });

  it("tenant vazio → grava o log SEM tenant_id (sem tentativa dupla) e não lança", async () => {
    await expect(auditarEscritaCopiloto("", "hub_atualizar_lead", "lead-9", true)).resolves.toBeUndefined();
    const l = logs();
    expect(l).toHaveLength(1);
    expect(l[0]).not.toHaveProperty("tenant_id");
  });
});
