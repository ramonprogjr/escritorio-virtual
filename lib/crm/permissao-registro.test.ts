import { describe, expect, it } from "vitest";
import { podeAlterarRegistro, autorRealDoComentario, autorNomeRegistro } from "./permissao-registro";

const OWNER = { userId: "u-owner", isOwner: true };
const AUTOR = { userId: "u-1", isOwner: false };
const OUTRO = { userId: "u-2", isOwner: false };

describe("permissão de registros — matriz do dono", () => {
  it("comentário: autor real edita/arquiva o dele", () => {
    expect(podeAlterarRegistro("comentario", "u-1", AUTOR)).toBe(true);
    expect(podeAlterarRegistro("comentario", "u-1", OUTRO)).toBe(false); // outro usuário não
  });
  it("comentário: owner altera qualquer um", () => {
    expect(podeAlterarRegistro("comentario", "u-1", OWNER)).toBe(true);
  });
  it("comentário legado (feito_por='humano' sentinela): sem autor → só owner", () => {
    expect(podeAlterarRegistro("comentario", "humano", { userId: "humano", isOwner: false })).toBe(false);
    expect(podeAlterarRegistro("comentario", "humano", OWNER)).toBe(true);
  });
  it("atividade_principal: SÓ owner", () => {
    expect(podeAlterarRegistro("atividade_principal", "u-1", AUTOR)).toBe(false);
    expect(podeAlterarRegistro("atividade_principal", "u-1", OWNER)).toBe(true);
  });
  it("log: NINGUÉM (nem owner)", () => {
    expect(podeAlterarRegistro("log", "u-1", AUTOR)).toBe(false);
    expect(podeAlterarRegistro("log", "u-1", OWNER)).toBe(false);
  });

  it("autorRealDoComentario: userId vazio ou sentinela nunca é autor", () => {
    expect(autorRealDoComentario("u-1", "u-1")).toBe(true);
    expect(autorRealDoComentario("humano", "humano")).toBe(false);
    expect(autorRealDoComentario("u-1", "")).toBe(false);
    expect(autorRealDoComentario("u-1", "u-2")).toBe(false);
  });

  it("autorNomeRegistro: esconde o código", () => {
    expect(autorNomeRegistro("mari", "ia", "u-1")).toBe("IA");
    expect(autorNomeRegistro("u-1", "humano", "u-1")).toBe("Você");
    expect(autorNomeRegistro("humano", "humano", "u-9")).toBe("Equipe");
    expect(autorNomeRegistro("Ana Silva", "humano", "u-9")).toBe("Ana Silva");
  });
});
