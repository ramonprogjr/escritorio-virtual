import { describe, expect, it } from "vitest";
import { buscarPessoaPorDocumento } from "./buscar-pessoa-documento";
import { DEFAULT_OBRA10_TENANT_ID, tenantScopeOrFilter } from "@/lib/tenant-default";

type SupabaseLike = Parameters<typeof buscarPessoaPorDocumento>[0];

/**
 * Mock encadeável: from/select/eq → this; .or(filtro) registra o escopo de tenant;
 * .maybeSingle() resolve com a primeira linha cujo documento gravado bate.
 */
function mockSupabase(rowsByDocumento: Record<string, unknown>) {
  const orFiltros: string[] = [];
  let docFiltro: string | null = null;
  const q: Record<string, unknown> = {};
  q.from = () => q;
  q.select = () => q;
  q.eq = (_col: string, val: string) => {
    docFiltro = val;
    return q;
  };
  q.or = (filtro: string) => {
    orFiltros.push(filtro);
    return q;
  };
  q.maybeSingle = () =>
    Promise.resolve({ data: docFiltro ? rowsByDocumento[docFiltro] ?? null : null, error: null });
  return { supabase: q as unknown as SupabaseLike, orFiltros };
}

const PESSOA = { id: "p1", nome: "Fulano", codigo: "PS2026001", tipo_pessoa: "PF", documento: "12345678901" };

describe("buscarPessoaPorDocumento", () => {
  it("acha por dígitos puros (sem máscara)", async () => {
    const { supabase } = mockSupabase({ "12345678901": PESSOA });
    const out = await buscarPessoaPorDocumento(supabase, "PF", "123.456.789-01");
    expect(out?.id).toBe("p1");
  });

  it("acha quando gravado COM máscara (variante mascarada)", async () => {
    const { supabase } = mockSupabase({ "123.456.789-01": PESSOA });
    const out = await buscarPessoaPorDocumento(supabase, "PF", "12345678901");
    expect(out?.id).toBe("p1");
  });

  it("aplica escopo de tenant na busca quando tenantId é informado", async () => {
    const { supabase, orFiltros } = mockSupabase({ "12345678901": PESSOA });
    await buscarPessoaPorDocumento(supabase, "PF", "12345678901", DEFAULT_OBRA10_TENANT_ID);
    expect(orFiltros.length).toBeGreaterThan(0);
    expect(orFiltros[0]).toBe(tenantScopeOrFilter(DEFAULT_OBRA10_TENANT_ID));
  });

  it("NÃO aplica .or() quando tenantId é omitido (comportamento legado global)", async () => {
    const { supabase, orFiltros } = mockSupabase({ "12345678901": PESSOA });
    await buscarPessoaPorDocumento(supabase, "PF", "12345678901");
    expect(orFiltros).toEqual([]);
  });

  it("documento vazio → null sem consultar", async () => {
    const { supabase } = mockSupabase({});
    expect(await buscarPessoaPorDocumento(supabase, "PF", "")).toBeNull();
  });
});
