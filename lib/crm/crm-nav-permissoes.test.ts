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

describe("Rede: Parceiros + Fornecedores + Especialistas", () => {
  it("comercial+ veem os 3 itens da Rede", () => {
    for (const r of ["comercial", "gestor", "owner"]) {
      const h = hrefs(r);
      expect(h).toContain("/crm/parceiros");
      expect(h).toContain("/crm/fornecedores");
      expect(h).toContain("/crm/especialistas");
    }
  });
  it("atendente não vê a Rede (minRole comercial)", () => {
    expect(hrefs("atendente")).not.toContain("/crm/fornecedores");
  });
});

describe('P0: "Progresso sistema" fora do menu do produto', () => {
  it("nenhum papel vê /crm/progresso-sistema no menu", () => {
    for (const r of ["owner", "gestor", "comercial", "financeiro", "atendente"]) {
      expect(hrefs(r)).not.toContain("/crm/progresso-sistema");
    }
  });
});

// ── ONDA 2 — personas técnicas (architect/operation) ──────────────────────────
describe("Onda 2: acesso à fila de aprovações por CAPABILITY (não por nível)", () => {
  it("architect e operation PODEM ver /crm/aprovacoes (chave técnica de escrow)", () => {
    expect(crmPodeVerRota("architect", "/crm/aprovacoes")).toBe(true);
    expect(crmPodeVerRota("operation", "/crm/aprovacoes")).toBe(true);
  });

  it("gestor/owner mantêm acesso à fila (veem tudo)", () => {
    expect(crmPodeVerRota("gestor", "/crm/aprovacoes")).toBe(true);
    expect(crmPodeVerRota("owner", "/crm/aprovacoes")).toBe(true);
  });

  it("SEM over-grant: comercial/financeiro/atendente continuam sem a fila", () => {
    expect(crmPodeVerRota("comercial", "/crm/aprovacoes")).toBe(false);
    expect(crmPodeVerRota("financeiro", "/crm/aprovacoes")).toBe(false);
    expect(crmPodeVerRota("atendente", "/crm/aprovacoes")).toBe(false);
  });

  it("a capability NÃO abre outras rotas (exceção cirúrgica só p/ /crm/aprovacoes)", () => {
    // architect tem escrow:chave_tecnica mas nível comercial → nada de admin/financeiro.
    expect(crmPodeVerRota("architect", "/crm/financeiro")).toBe(false);
    expect(crmPodeVerRota("architect", "/crm/empresas")).toBe(false);
    expect(crmPodeVerRota("architect", "/crm/distribuicao")).toBe(false);
  });
});

describe("Onda 2: nav persona-aware esconde grupos fora da persona", () => {
  it("architect NÃO vê grupos Comercial nem Fornecedores", () => {
    const h = hrefs("architect");
    for (const leak of [
      "/crm/leads",
      "/crm/negocios",
      "/crm/cadastro",
      "/crm/atendimento",
      "/crm/parceiros",
      "/crm/fornecedores",
      "/crm/especialistas",
    ]) {
      expect(h).not.toContain(leak);
    }
  });

  it("architect vê SÓ Arquitetura em Operações (não Engenharia/Imóveis/Pedidos)", () => {
    const h = hrefs("architect");
    expect(h).toContain("/crm/arquitetura");
    expect(h).not.toContain("/crm/obras");
    expect(h).not.toContain("/crm/imoveis");
    expect(h).not.toContain("/crm/pedidos");
  });

  it("operation vê Engenharia + Pedidos (não Arquitetura/Imóveis)", () => {
    const h = hrefs("operation");
    expect(h).toContain("/crm/obras");
    expect(h).toContain("/crm/pedidos");
    expect(h).not.toContain("/crm/arquitetura");
    expect(h).not.toContain("/crm/imoveis");
  });

  it("architect e operation veem Dashboard + 'Chaves a assinar' (fila filtrada)", () => {
    for (const r of ["architect", "operation"]) {
      const h = hrefs(r);
      expect(h).toContain("/crm");
      expect(h).toContain("/crm/aprovacoes");
    }
  });

  it("architect/operation NÃO recebem grupos de gestor+ (marketing/ia/admin)", () => {
    for (const r of ["architect", "operation"]) {
      const h = hrefs(r);
      for (const g of ["/crm/trafego", "/crm/agentes", "/crm/configuracoes", "/crm/usuarios"]) {
        expect(h).not.toContain(g);
      }
    }
  });
});

describe("Onda 2 REGRESSÃO: menu dos papéis internos intocado", () => {
  it("comercial mantém seu menu e NÃO ganha 'Chaves a assinar'", () => {
    const h = hrefs("comercial");
    expect(h).toContain("/crm/negocios");
    expect(h).toContain("/crm/parceiros");
    expect(h).toContain("/crm/arquitetura");
    expect(h).toContain("/crm/obras");
    // /crm/aprovacoes é minRole gestor → comercial nunca vê (nem via capability).
    expect(h).not.toContain("/crm/aprovacoes");
  });

  it("gestor e owner mantêm o item 'Aprovações' (grupo Comercial)", () => {
    expect(hrefs("gestor")).toContain("/crm/aprovacoes");
    expect(hrefs("owner")).toContain("/crm/aprovacoes");
  });

  it("financeiro e atendente inalterados (sem persona-restrição nova)", () => {
    expect(hrefs("financeiro")).toContain("/crm/financeiro");
    expect(hrefs("atendente")).toContain("/crm/atendimento");
  });
});
