import { describe, expect, it } from "vitest";
import { CRM_NAV_GROUPS, filterCrmNavGroupsForRole } from "@/lib/crm-nav-groups";

// 3a superficie de RBAC: o MENU lateral por papel (filterCrmNavGroupsForRole).
// Usa o mesmo predicado do guard de rota (crmPodeVerRota) + allowlist persona-aware
// da Onda 2. Se quebrar, aparece "menu morto"/errado ou vaza item de outra persona.
// Puro (node), sem mock — usa CRM_NAV_GROUPS e role-map reais.

const hrefs = (role: string) =>
  filterCrmNavGroupsForRole(CRM_NAV_GROUPS, role).flatMap(g => g.items.map(i => i.href));
const groupIds = (role: string) =>
  filterCrmNavGroupsForRole(CRM_NAV_GROUPS, role).map(g => g.id);

describe("filterCrmNavGroupsForRole — personas INTERNAS filtram por NIVEL", () => {
  it("comercial ve negocios/leads, NAO ve aprovacoes/financeiro/usuarios/escritorios", () => {
    const h = hrefs("commercial");
    expect(h).toContain("/crm/negocios");
    expect(h).toContain("/crm/leads");
    expect(h).not.toContain("/crm/aprovacoes"); // gestor+
    expect(h).not.toContain("/crm/financeiro/receber"); // funcao financeiro
    expect(h).not.toContain("/crm/usuarios"); // gestor+
    expect(h).not.toContain("/crm/empresas"); // owner
  });
  it("owner ve os itens owner-only (Escritorios, Aprovacoes, Financeiro)", () => {
    const h = hrefs("owner");
    expect(h).toContain("/crm/empresas");
    expect(h).toContain("/crm/aprovacoes");
    expect(h).toContain("/crm/financeiro/receber");
    expect(groupIds("owner")).toContain("administracao");
  });
  it("nao produz grupo vazio (sem 'menu morto')", () => {
    for (const g of filterCrmNavGroupsForRole(CRM_NAV_GROUPS, "gestor")) {
      expect(g.items.length).toBeGreaterThan(0);
    }
  });
});

describe("filterCrmNavGroupsForRole — persona TECNICA ve so o seu modulo + Chaves", () => {
  it("arquiteto: Visao + Operacoes(so Arquitetura) + 'Chaves a assinar'; sem Comercial", () => {
    expect(groupIds("architect")).toEqual(["visao", "operacoes"]);
    const h = hrefs("architect");
    expect(h).toContain("/crm/arquitetura");
    expect(h).toContain("/crm/aprovacoes"); // "Chaves a assinar"
    expect(h).not.toContain("/crm/negocios"); // grupo comercial escondido
    expect(h).not.toContain("/crm/obras"); // operacoes, mas fora da allowlist do arquiteto
  });
  it("engenharia (operation): Operacoes(Engenharia+Pedidos) + Chaves; sem Arquitetura", () => {
    expect(groupIds("operation")).toEqual(["visao", "operacoes"]);
    const h = hrefs("operation");
    expect(h).toContain("/crm/obras");
    expect(h).toContain("/crm/pedidos");
    expect(h).toContain("/crm/aprovacoes");
    expect(h).not.toContain("/crm/arquitetura");
    expect(h).not.toContain("/crm/negocios");
  });
});

describe("filterCrmNavGroupsForRole — personas EXTERNAS nao veem /crm (fail-closed)", () => {
  it("fornecedor/parceiro/cliente = menu vazio", () => {
    expect(filterCrmNavGroupsForRole(CRM_NAV_GROUPS, "supplier")).toEqual([]);
    expect(filterCrmNavGroupsForRole(CRM_NAV_GROUPS, "broker")).toEqual([]);
    expect(filterCrmNavGroupsForRole(CRM_NAV_GROUPS, "client")).toEqual([]);
  });
  it("papel desconhecido = menu vazio", () => {
    expect(filterCrmNavGroupsForRole(CRM_NAV_GROUPS, "xpto")).toEqual([]);
  });
});
