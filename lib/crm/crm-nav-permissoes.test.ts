import { describe, expect, it } from "vitest";
import { CRM_NAV_GROUPS, filterCrmNavGroupsForRole } from "@/lib/crm-nav-groups";
import { crmPodeVerRota } from "@/lib/crm/crm-permissoes";

function hrefs(role: string): string[] {
  return filterCrmNavGroupsForRole(CRM_NAV_GROUPS, role).flatMap(g => g.items.map(i => i.href));
}

describe("P0: comercial NÃO vê/acessa Financeiro (papéis ortogonais)", () => {
  it("guard de rota bloqueia comercial no Financeiro e subrotas", () => {
    expect(crmPodeVerRota("comercial", "/crm/financeiro")).toBe(false);
    expect(crmPodeVerRota("comercial", "/crm/financeiro/pagar")).toBe(false);
    expect(crmPodeVerRota("comercial", "/crm/financeiro/receber")).toBe(false);
  });

  it("financeiro/gestor/owner mantêm acesso ao Financeiro", () => {
    for (const r of ["financeiro", "gestor", "owner"]) {
      expect(crmPodeVerRota(r, "/crm/financeiro")).toBe(true);
      expect(crmPodeVerRota(r, "/crm/financeiro/pagar")).toBe(true);
    }
  });

  it("atendente continua sem Financeiro", () => {
    expect(crmPodeVerRota("atendente", "/crm/financeiro")).toBe(false);
  });

  it("menu de comercial NÃO contém nenhum item de Financeiro", () => {
    expect(hrefs("comercial").some(h => h.startsWith("/crm/financeiro"))).toBe(false);
  });

  it("menu de financeiro CONTÉM o Financeiro", () => {
    expect(hrefs("financeiro").some(h => h.startsWith("/crm/financeiro"))).toBe(true);
  });
});

describe("regressão: papéis legítimos não foram trancados", () => {
  it("owner vê tudo (Financeiro, Empresas, Integrações, Negócios)", () => {
    for (const h of ["/crm/financeiro", "/crm/empresas", "/crm/integracoes", "/crm/negocios"]) {
      expect(crmPodeVerRota("owner", h)).toBe(true);
    }
    const owner = hrefs("owner");
    expect(owner).toContain("/crm/financeiro");
    expect(owner).toContain("/crm/negocios");
  });

  it("comercial mantém Vendas e Dashboard; não vê Admin", () => {
    expect(crmPodeVerRota("comercial", "/crm/negocios")).toBe(true);
    expect(crmPodeVerRota("comercial", "/crm")).toBe(true);
    expect(crmPodeVerRota("comercial", "/crm/empresas")).toBe(false);
  });

  it("atendente mantém Inbox/Leads e não vê Negócios", () => {
    expect(crmPodeVerRota("atendente", "/crm/atendimento")).toBe(true);
    expect(crmPodeVerRota("atendente", "/crm/leads")).toBe(true);
    expect(crmPodeVerRota("atendente", "/crm/negocios")).toBe(false);
  });
});

describe('P0: "Progresso sistema" fora do menu do produto', () => {
  it("nenhum papel vê /crm/progresso-sistema no menu", () => {
    for (const r of ["owner", "gestor", "comercial", "financeiro", "atendente"]) {
      expect(hrefs(r)).not.toContain("/crm/progresso-sistema");
    }
  });
});
