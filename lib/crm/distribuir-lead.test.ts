import { describe, expect, it } from "vitest";
import { listarCandidatosParceiro, melhorCandidatoParceiro } from "./distribuir-lead";

/** Mock encadeável do SupabaseClient: from/select/eq/or → this; limit → Promise<{data,error}>. */
function mockSupabase(rows: unknown[] | null, error: unknown = null) {
  const q: Record<string, unknown> = {};
  for (const m of ["from", "select", "eq", "or"]) q[m] = () => q;
  q.limit = () => Promise.resolve({ data: rows, error });
  return q as unknown as Parameters<typeof listarCandidatosParceiro>[0];
}

const INPUT = { mercado: "ARQ", cidade: "São Paulo", estado: "SP" } as const;

// A: mercado ARQ(40) + mesma cidade(30) + carga 0(20) + homologado(10) = 100
const A = { id: "A", nome: "Arq A", telefone: "1", mercado: "ARQ", especialidade: null, cidade: "São Paulo", estado: "SP", status: "homologado", recebe_leads: true, total_leads_recebidos: 0 };
// B: mercado ENG(0) + mesmo UF(15) + carga 5(15) + homologado(10) = 40
const B = { id: "B", nome: "Eng B", telefone: "2", mercado: "ENG", especialidade: null, cidade: "Rio", estado: "SP", status: "homologado", recebe_leads: true, total_leads_recebidos: 5 };
// C: sem mercado(5) + carga 0(20) + aprovado(10) = 35
const C = { id: "C", nome: "Gen C", telefone: "3", mercado: null, especialidade: null, cidade: "Curitiba", estado: "PR", status: "aprovado", recebe_leads: true, total_leads_recebidos: 0 };
// D: mercado ENG(0) + sem geo + carga 30(0) + pendente(0) = 0 → cortado (score < 10)
const D = { id: "D", nome: "Eng D", telefone: "4", mercado: "ENG", especialidade: null, cidade: "Salvador", estado: "BA", status: "pendente", recebe_leads: true, total_leads_recebidos: 30 };

describe("listarCandidatosParceiro — scoring e ranking (IA-first)", () => {
  it("rankeia por score, corta score<10 e ordena desc", async () => {
    const out = await listarCandidatosParceiro(mockSupabase([A, B, C, D]), INPUT);
    expect(out.map((c) => c.parceiro_id)).toEqual(["A", "B", "C"]); // D cortado
    expect(out.map((c) => c.score)).toEqual([100, 40, 35]);
  });

  it("respeita o limite", async () => {
    const out = await listarCandidatosParceiro(mockSupabase([A, B, C]), { ...INPUT, limite: 2 });
    expect(out.map((c) => c.parceiro_id)).toEqual(["A", "B"]);
  });

  it("data vazia/erro → []", async () => {
    expect(await listarCandidatosParceiro(mockSupabase([]), INPUT)).toEqual([]);
    expect(await listarCandidatosParceiro(mockSupabase(null, { message: "x" }), INPUT)).toEqual([]);
  });

  it("motivo explica o score (transparência do encaminhamento)", async () => {
    const [top] = await listarCandidatosParceiro(mockSupabase([A]), INPUT);
    expect(top.motivo).toContain("mercado ARQ");
    expect(top.motivo).toContain("mesma cidade");
    expect(top.motivo).toContain("homologado");
  });
});

describe("fila de distribuição — top-3 do motor (sem LLM)", () => {
  it("limita a 3 candidatos rankeados (contrato da Fila de distribuição)", async () => {
    const out = await listarCandidatosParceiro(mockSupabase([B, A, C, D]), { ...INPUT, limite: 3 });
    expect(out.map((c) => c.parceiro_id)).toEqual(["A", "B", "C"]); // D cortado, top-3 ordenado
    expect(out[0].score).toBeGreaterThanOrEqual(out[1].score);
    expect(out[1].score).toBeGreaterThanOrEqual(out[2].score);
  });
});

describe("melhorCandidatoParceiro", () => {
  it("retorna o de maior score", async () => {
    const best = await melhorCandidatoParceiro(mockSupabase([B, A, C]), INPUT);
    expect(best?.parceiro_id).toBe("A");
    expect(best?.score).toBe(100);
  });
  it("sem candidatos → null", async () => {
    expect(await melhorCandidatoParceiro(mockSupabase([D]), INPUT)).toBeNull();
  });
});
