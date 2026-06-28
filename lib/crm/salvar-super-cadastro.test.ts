import { describe, expect, it } from "vitest";
import { salvarSuperCadastro } from "./salvar-super-cadastro";
import { validarSuperCadastro } from "./validar-super-cadastro";
import { DEFAULT_OBRA10_TENANT_ID, tenantScopeOrFilter } from "@/lib/tenant-default";

const TENANT = DEFAULT_OBRA10_TENANT_ID;

function validar(extra?: Record<string, unknown>) {
  // PF, sem documento, criar_lead:false → exercita só dedup + insert de pessoa
  // (evita o pipeline de lead/empresa, fora do escopo destes fixes).
  const parsed = validarSuperCadastro({
    tipo_pessoa: "PF",
    nome: "Cliente Teste",
    telefone: "11999998888",
    comercial: { criar_lead: false, mercados: [], lead_origem: "outro" },
    ...extra,
  });
  if (!parsed.ok) throw new Error(`fixture inválida: ${parsed.erro}`);
  return parsed.data;
}

/**
 * Mock de supabase para os caminhos de dedup/insert de pessoa.
 * - hub_pessoas .select.eq("telefone").or().maybeSingle() → telDup
 * - registra os filtros .or() (escopo de tenant) aplicados.
 */
function mockSupabase(opts: { telDup?: unknown }) {
  const orFiltros: string[] = [];
  const q: Record<string, unknown> = {};
  q.from = () => q;
  q.select = () => q;
  q.eq = () => q;
  q.or = (filtro: string) => {
    orFiltros.push(filtro);
    return q;
  };
  q.maybeSingle = () => Promise.resolve({ data: opts.telDup ?? null, error: null });
  // rpc usada pelo gerador de código (crm_proximo_codigo)
  q.rpc = () => Promise.resolve({ data: "PS2026001", error: null });
  return { supabase: q as unknown as Parameters<typeof salvarSuperCadastro>[0], orFiltros };
}

describe("salvarSuperCadastro — dedup + integridade (PRIORIDADE #1)", () => {
  it("telefone duplicado → 409 SEM vazar nome/código de outro registo", async () => {
    const { supabase } = mockSupabase({
      telDup: { id: "outro", nome: "Cliente De Outro Escritório", codigo: "PS2026999" },
    });
    const res = await salvarSuperCadastro(supabase, validar(), {
      tenantId: TENANT,
      insertHubPessoa: async () => ({ data: { id: "x" }, error: null }),
      insertHubEmpresa: async () => ({ data: null, error: null }),
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.status).toBe(409);
    expect(res.error).not.toContain("Cliente De Outro");
    expect(res.error).not.toContain("PS2026999");
  });

  it("dedup de telefone aplica escopo de tenant (.or)", async () => {
    const { supabase, orFiltros } = mockSupabase({ telDup: null });
    await salvarSuperCadastro(supabase, validar(), {
      tenantId: TENANT,
      insertHubPessoa: async () => ({ data: { id: "p1", codigo: "PS2026001" }, error: null }),
      insertHubEmpresa: async () => ({ data: null, error: null }),
    });
    expect(orFiltros).toContain(tenantScopeOrFilter(TENANT));
  });

  it("insert com violação de UNIQUE (23505) → 409, não 500 genérico", async () => {
    const { supabase } = mockSupabase({ telDup: null });
    const res = await salvarSuperCadastro(supabase, validar(), {
      tenantId: TENANT,
      insertHubPessoa: async () => ({ data: null, error: { code: "23505", message: "duplicate key" } }),
      insertHubEmpresa: async () => ({ data: null, error: null }),
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.status).toBe(409);
  });

  it("insert com erro genérico → 500 (comportamento preservado)", async () => {
    const { supabase } = mockSupabase({ telDup: null });
    const res = await salvarSuperCadastro(supabase, validar(), {
      tenantId: TENANT,
      insertHubPessoa: async () => ({ data: null, error: { code: "XXXXX", message: "boom" } }),
      insertHubEmpresa: async () => ({ data: null, error: null }),
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.status).toBe(500);
  });

  it("sem duplicata → grava pessoa e retorna ok", async () => {
    const { supabase } = mockSupabase({ telDup: null });
    const res = await salvarSuperCadastro(supabase, validar(), {
      tenantId: TENANT,
      insertHubPessoa: async () => ({ data: { id: "p1", codigo: "PS2026001" }, error: null }),
      insertHubEmpresa: async () => ({ data: null, error: null }),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.pessoa_id).toBe("p1");
  });
});
