import { describe, expect, it } from "vitest";
import { isCrmGestorRole } from "@/lib/crm/crm-permissoes";
import { roleTemCapacidade } from "@/lib/rbac/role-map";
import { TIPOS_ESCROW_CHAVE_TECNICA } from "@/lib/crm/aprovacoes-tipos";

/**
 * ONDA 2 — invariante (a)/(c): o GET /api/hub/aprovacoes filtra a fila por CAPABILITY do
 * solicitante. Este teste fixa o predicado `soAssinaChave` (exatamente o que a rota computa,
 * espelhando aprovar()/rejeitar()) e o subconjunto estreito de tipos, sem precisar mockar o
 * Supabase. Se alguém alargar o Set ou trocar a regra, o gate de leitura quebra o teste.
 */
function soAssinaChave(role: string): boolean {
  return (
    !isCrmGestorRole(role) &&
    (roleTemCapacidade(role, "escrow:chave_tecnica") ||
      roleTemCapacidade(role, "escrow:chave_hub"))
  );
}

describe("Onda 2: filtro por capability da fila de aprovações", () => {
  it("architect e operation são escrow-cap-NÃO-gestor → recebem SÓ tipos de escrow", () => {
    expect(soAssinaChave("architect")).toBe(true);
    expect(soAssinaChave("operation")).toBe(true);
  });

  it("gestor/owner NÃO são filtrados (veem TUDO — invariante c)", () => {
    // owner carrega escrow:chave_hub mas é gestor+ → fora do filtro (vê tudo).
    expect(soAssinaChave("owner")).toBe(false);
    expect(soAssinaChave("gestor")).toBe(false);
    expect(soAssinaChave("admin")).toBe(false);
  });

  it("comercial/financeiro/atendente não têm chave → filtro não se aplica (mas guard os barra)", () => {
    for (const r of ["comercial", "financeiro", "atendente"]) {
      expect(soAssinaChave(r)).toBe(false);
    }
  });

  it("subconjunto estreito = SÓ pagamento_obra_arq/hub (sem cotação/orçamento comercial)", () => {
    expect([...TIPOS_ESCROW_CHAVE_TECNICA]).toEqual([
      "pagamento_obra_arq",
      "pagamento_obra_hub",
    ]);
    expect(TIPOS_ESCROW_CHAVE_TECNICA).not.toContain("orcamento_frente");
    expect(TIPOS_ESCROW_CHAVE_TECNICA).not.toContain("cotacao_fornecedor");
  });
});
