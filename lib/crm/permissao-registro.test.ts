import { describe, expect, it } from "vitest";
import { podeAlterarRegistro, autorRealDoComentario, autorNomeRegistro, ehUuid } from "./permissao-registro";

const UUID_COLEGA = "3f8a9b12-1c2d-4e5f-8a9b-0c1d2e3f4a5b";

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

  it("autorNomeRegistro: NUNCA vaza o UUID cru de um colega (fix A2)", () => {
    // Sem nome resolvido → cai para 'Equipe', jamais o UUID.
    expect(autorNomeRegistro(UUID_COLEGA, "humano", "u-9")).toBe("Equipe");
    // Com nome resolvido (lookup no servidor) → mostra o nome real.
    expect(autorNomeRegistro(UUID_COLEGA, "humano", "u-9", "Bruno Costa")).toBe("Bruno Costa");
    // O próprio autor continua "Você" mesmo com nome resolvido.
    expect(autorNomeRegistro(UUID_COLEGA, "humano", UUID_COLEGA, "Bruno Costa")).toBe("Você");
  });

  it("ehUuid: distingue UUID de nome legível e sentinela", () => {
    expect(ehUuid(UUID_COLEGA)).toBe(true);
    expect(ehUuid("Ana Silva")).toBe(false);
    expect(ehUuid("humano")).toBe(false);
    expect(ehUuid("")).toBe(false);
    expect(ehUuid(null)).toBe(false);
  });
});
