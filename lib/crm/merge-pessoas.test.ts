import { describe, expect, it } from "vitest";
import {
  scorePessoa,
  decidirVencedor,
  documentosConflitam,
  detectarParesDuplicados,
  telefoneDigits,
  emailCanonico,
  type PessoaMergeRow,
} from "./merge-pessoas";

function pessoa(over: Partial<PessoaMergeRow>): PessoaMergeRow {
  return { id: "id-" + Math.random().toString(36).slice(2), nome: "Fulano", ...over };
}

describe("merge-pessoas — normalização", () => {
  it("telefone canônico tira DDI 55 e mantém últimos dígitos", () => {
    expect(telefoneDigits("+55 (11) 99999-8888")).toBe("11999998888");
    expect(telefoneDigits("11999998888")).toBe("11999998888");
    expect(telefoneDigits(null)).toBe("");
  });
  it("email canônico = trim + lowercase", () => {
    expect(emailCanonico("  Joao@Mail.COM ")).toBe("joao@mail.com");
  });
});

describe("merge-pessoas — scorePessoa", () => {
  it("conta campos relevantes preenchidos", () => {
    const vazio = pessoa({ id: "a" });
    const cheio = pessoa({
      id: "b",
      documento: "12345678901",
      email: "x@y.com",
      telefone: "11999998888",
      cidade: "SP",
      estado: "SP",
    });
    expect(scorePessoa(cheio)).toBeGreaterThan(scorePessoa(vazio));
  });

  it("vínculos e negócios pesam mais que campo isolado", () => {
    const base = pessoa({ id: "a", email: "x@y.com" }); // 1 campo
    const comHistorico = pessoa({ id: "b" });
    expect(scorePessoa(comHistorico, { vinculos: 1 })).toBeGreaterThan(scorePessoa(base));
  });
});

describe("merge-pessoas — decidirVencedor (regra do CEO)", () => {
  it("registo com MAIS campos preenchidos vence", () => {
    const pobre = pessoa({ id: "a", nome: "A", criado_em: "2026-01-01T00:00:00Z" });
    const rico = pessoa({
      id: "b",
      nome: "B",
      documento: "12345678901",
      email: "b@y.com",
      cidade: "SP",
      criado_em: "2026-02-01T00:00:00Z",
    });
    expect(decidirVencedor(pobre, rico)).toEqual({ vencedorId: "b", perdedorId: "a" });
  });

  it("empate de score → menor criado_em (mais antigo) vence", () => {
    const antigo = pessoa({ id: "a", email: "x@y.com", criado_em: "2026-01-01T00:00:00Z" });
    const novo = pessoa({ id: "b", email: "x@y.com", criado_em: "2026-06-01T00:00:00Z" });
    expect(decidirVencedor(novo, antigo)).toEqual({ vencedorId: "a", perdedorId: "b" });
  });

  it("empate total → menor id (determinístico, independe da ordem)", () => {
    const a = pessoa({ id: "aaa", email: "x@y.com", criado_em: "2026-01-01T00:00:00Z" });
    const b = pessoa({ id: "bbb", email: "x@y.com", criado_em: "2026-01-01T00:00:00Z" });
    expect(decidirVencedor(a, b)).toEqual(decidirVencedor(b, a));
    expect(decidirVencedor(a, b).vencedorId).toBe("aaa");
  });

  it("contagens por lado favorecem o de mais histórico no empate de campos", () => {
    const a = pessoa({ id: "a", email: "x@y.com", criado_em: "2026-03-01T00:00:00Z" });
    const b = pessoa({ id: "b", email: "x@y.com", criado_em: "2026-01-01T00:00:00Z" });
    // a tem 2 negócios → score maior, vence mesmo sendo mais novo
    const r = decidirVencedor(a, b, { a: { negocios: 2 }, b: {} });
    expect(r.vencedorId).toBe("a");
  });
});

describe("merge-pessoas — documentosConflitam (bloqueio)", () => {
  it("documentos diferentes preenchidos → conflito", () => {
    const a = pessoa({ id: "a", documento: "111.444.777-35" });
    const b = pessoa({ id: "b", documento: "22233344405" });
    expect(documentosConflitam(a, b)).toBe(true);
  });
  it("mesmo documento (com/sem máscara) → NÃO conflita", () => {
    const a = pessoa({ id: "a", documento: "111.444.777-35" });
    const b = pessoa({ id: "b", documento: "11144477735" });
    expect(documentosConflitam(a, b)).toBe(false);
  });
  it("um sem documento → NÃO conflita", () => {
    const a = pessoa({ id: "a", documento: "11144477735" });
    const b = pessoa({ id: "b", documento: null });
    expect(documentosConflitam(a, b)).toBe(false);
  });
});

describe("merge-pessoas — detectarParesDuplicados", () => {
  it("agrupa por telefone e marca motivo", () => {
    const pares = detectarParesDuplicados([
      pessoa({ id: "a", telefone: "11999998888" }),
      pessoa({ id: "b", telefone: "+55 (11) 99999-8888" }),
      pessoa({ id: "c", telefone: "11888887777" }),
    ]);
    expect(pares).toHaveLength(1);
    expect(pares[0].motivos).toContain("telefone");
  });

  it("mesmo documento → motivo documento e par detectado", () => {
    const pares = detectarParesDuplicados([
      pessoa({ id: "a", documento: "111.444.777-35", telefone: "11111111111" }),
      pessoa({ id: "b", documento: "11144477735", telefone: "22222222222" }),
    ]);
    expect(pares).toHaveLength(1);
    expect(pares[0].motivos).toContain("documento");
  });

  it("acumula múltiplos motivos no mesmo par", () => {
    const pares = detectarParesDuplicados([
      pessoa({ id: "a", documento: "11144477735", telefone: "11999998888", email: "x@y.com" }),
      pessoa({ id: "b", documento: "11144477735", telefone: "11999998888", email: "x@y.com" }),
    ]);
    expect(pares).toHaveLength(1);
    expect(pares[0].motivos.sort()).toEqual(["documento", "email", "telefone"]);
  });

  it("ignora registos arquivados", () => {
    const pares = detectarParesDuplicados([
      pessoa({ id: "a", telefone: "11999998888" }),
      pessoa({ id: "b", telefone: "11999998888", arquivado_em: "2026-06-01T00:00:00Z" }),
    ]);
    expect(pares).toHaveLength(0);
  });

  it("marca documentosConflitam quando agrupados por telefone mas docs diferem", () => {
    const pares = detectarParesDuplicados([
      pessoa({ id: "a", telefone: "11999998888", documento: "11144477735" }),
      pessoa({ id: "b", telefone: "11999998888", documento: "22233344405" }),
    ]);
    expect(pares).toHaveLength(1);
    expect(pares[0].documentosConflitam).toBe(true);
  });

  it("telefone curto demais não gera falso par", () => {
    const pares = detectarParesDuplicados([
      pessoa({ id: "a", telefone: "123" }),
      pessoa({ id: "b", telefone: "123" }),
    ]);
    expect(pares).toHaveLength(0);
  });

  it("base sem duplicatas → lista vazia", () => {
    const pares = detectarParesDuplicados([
      pessoa({ id: "a", telefone: "11111111111", email: "a@y.com" }),
      pessoa({ id: "b", telefone: "22222222222", email: "b@y.com" }),
    ]);
    expect(pares).toHaveLength(0);
  });
});
