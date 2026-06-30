import { describe, expect, it } from "vitest";
import { garantirPessoaParaLead } from "./garantir-pessoa-lead";
import { DEFAULT_OBRA10_TENANT_ID, tenantScopeOrFilter } from "@/lib/tenant-default";

const TENANT = DEFAULT_OBRA10_TENANT_ID;

/**
 * Mock de supabase para os caminhos de dedup/insert de pessoa.
 *
 * Encadeamento usado pelo helper:
 *   - buscarPessoaPorDocumento → from().select().eq("documento", X).or(scope).maybeSingle()
 *     (o helper só chama .or() quando há tenantId; o teste sempre passa TENANT)
 *   - busca por telefone        → from().select().eq("telefone", X).or(scope).maybeSingle()
 *   - gerarCodigoPessoa         → rpc(...) (crm_proximo_codigo) → string
 *   - insert                    → from().insert(row).select().single()
 *
 * `rows`: cada chamada a maybeSingle() consome o próximo valor da fila (ordem das buscas).
 * `inserts`: registra os payloads efetivamente enviados ao insert (p/ provar não-duplicação).
 * `orFiltros`: registra os escopos .or() aplicados (p/ provar tenant-safety).
 */
function mockSupabase(opts: {
  /** Fila de respostas das buscas (maybeSingle), na ordem em que ocorrem. */
  buscas?: Array<unknown>;
  /** Resultado do insert (default: cria nova pessoa). */
  insertResult?: { data: unknown; error: unknown };
}) {
  const buscas = [...(opts.buscas ?? [])];
  const inserts: Record<string, unknown>[] = [];
  const orFiltros: string[] = [];
  let insertCount = 0;

  function makeQuery() {
    const q: Record<string, unknown> = {};
    q.from = () => q;
    q.select = () => q;
    q.eq = () => q;
    q.or = (filtro: string) => {
      orFiltros.push(filtro);
      return q;
    };
    q.maybeSingle = () =>
      Promise.resolve({ data: buscas.length > 0 ? buscas.shift() : null, error: null });
    q.insert = (row: Record<string, unknown>) => {
      inserts.push(row);
      insertCount += 1;
      return {
        select: () => ({
          single: () =>
            Promise.resolve(
              opts.insertResult ?? { data: { id: "nova-1", codigo: "PS2026010" }, error: null }
            ),
        }),
      };
    };
    q.rpc = () => Promise.resolve({ data: "PS2026010", error: null });
    return q;
  }

  const q = makeQuery();
  return {
    supabase: q as unknown as Parameters<typeof garantirPessoaParaLead>[0],
    inserts,
    orFiltros,
    get insertCount() {
      return insertCount;
    },
  };
}

describe("garantirPessoaParaLead — código único (dedup CPF/telefone, não duplica, vincula)", () => {
  it("dedup por CPF: pessoa com mesmo documento já existe → reusa, NÃO cria nova", async () => {
    const cpf = "39053344705"; // CPF válido
    const { supabase, insertCount } = mockSupabase({
      buscas: [
        // 1ª busca = buscarPessoaPorDocumento (variante dígitos) acha a pessoa
        { id: "pes-doc", nome: "Fulano", codigo: "PS2026001", tipo_pessoa: "PF", documento: cpf },
      ],
    });
    const res = await garantirPessoaParaLead(supabase, TENANT, {
      nome: "Fulano de Tal",
      telefone: "11999998888",
      documento: cpf,
    });
    expect(res.pessoaId).toBe("pes-doc");
    expect(res.codigo).toBe("PS2026001");
    expect(res.criada).toBe(false);
    expect(res.deduplicadaPor).toBe("documento");
    expect(insertCount).toBe(0); // não duplicou
  });

  it("dedup por telefone: sem documento, telefone já existe → reusa, NÃO cria nova", async () => {
    const { supabase, insertCount } = mockSupabase({
      buscas: [
        // sem documento → 1ª busca é por telefone, acha a pessoa
        { id: "pes-tel", codigo: "PS2026002" },
      ],
    });
    const res = await garantirPessoaParaLead(supabase, TENANT, {
      nome: "Beltrano",
      telefone: "11988887777",
      documento: null,
    });
    expect(res.pessoaId).toBe("pes-tel");
    expect(res.codigo).toBe("PS2026002");
    expect(res.criada).toBe(false);
    expect(res.deduplicadaPor).toBe("telefone");
    expect(insertCount).toBe(0);
  });

  it("nova pessoa: sem duplicata → cria e vincula (pessoa_id + código)", async () => {
    const { supabase, inserts } = mockSupabase({
      buscas: [null, null], // doc não acha, telefone não acha
      insertResult: { data: { id: "nova-9", codigo: "PS2026099" }, error: null },
    });
    const res = await garantirPessoaParaLead(supabase, TENANT, {
      nome: "Ciclano",
      telefone: "11977776666",
      documento: "39053344705",
    });
    expect(res.pessoaId).toBe("nova-9");
    expect(res.codigo).toBe("PS2026099");
    expect(res.criada).toBe(true);
    expect(res.deduplicadaPor).toBe(null);
    expect(inserts.length).toBe(1);
    // vinculável e tenant-safe: a pessoa nova nasce com tenant_id e telefone canônico
    expect(inserts[0].tenant_id).toBe(TENANT);
    expect(inserts[0].telefone).toBe("11977776666");
    expect(inserts[0].tipo).toBe("lead");
  });

  it("busca de telefone aplica escopo de tenant (.or)", async () => {
    const { supabase, orFiltros } = mockSupabase({ buscas: [null, null] });
    await garantirPessoaParaLead(supabase, TENANT, {
      nome: "Quem Seja",
      telefone: "11966665555",
      documento: null,
    });
    expect(orFiltros).toContain(tenantScopeOrFilter(TENANT));
  });

  it("corrida (23505) no insert → re-busca a existente, NÃO duplica", async () => {
    const { supabase } = mockSupabase({
      // sem documento → buscas são só por telefone: 1ª (inicial) não acha;
      // insert dá 23505; 2ª (re-busca) acha a existente.
      buscas: [null, { id: "pes-corrida", codigo: "PS2026003" }],
      insertResult: { data: null, error: { code: "23505", message: "duplicate key" } },
    });
    const res = await garantirPessoaParaLead(supabase, TENANT, {
      nome: "Corrida",
      telefone: "11955554444",
      documento: null,
    });
    expect(res.pessoaId).toBe("pes-corrida");
    expect(res.criada).toBe(false);
    expect(res.deduplicadaPor).toBe("telefone");
  });

  it("sem chave de dedup (sem telefone e sem documento) → vazio, não cria órfã", async () => {
    const { supabase, insertCount } = mockSupabase({});
    const res = await garantirPessoaParaLead(supabase, TENANT, {
      nome: "Só Nome",
      telefone: null,
      documento: null,
    });
    expect(res.pessoaId).toBe(null);
    expect(res.criada).toBe(false);
    expect(insertCount).toBe(0);
  });
});
