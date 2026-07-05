import { describe, expect, it } from "vitest";
import { defaultCrmHeaderForPath } from "@/lib/crm-header-defaults";

// Título/subtítulo padrão do cabeçalho por rota (30+ telas do CRM). Pura, node.
// Regressão típica: alguém renomeia um segmento e o título some/erra em várias telas.

describe("defaultCrmHeaderForPath", () => {
  it("fora do /crm cai em 'CRM'", () => {
    expect(defaultCrmHeaderForPath("/login").title).toBe("CRM");
    expect(defaultCrmHeaderForPath("/").title).toBe("CRM");
  });

  it("raiz /crm é o Dashboard", () => {
    // subtítulo é a data de hoje (não-determinístico) — só o título é assertável.
    expect(defaultCrmHeaderForPath("/crm").title).toBe("Dashboard");
  });

  it("rotas de lista usam o mapa de títulos", () => {
    expect(defaultCrmHeaderForPath("/crm/leads").title).toBe("Pipeline de Leads");
    expect(defaultCrmHeaderForPath("/crm/negocios").title).toBe("Negócios");
    expect(defaultCrmHeaderForPath("/crm/analytics").title).toBe("Analytics");
    expect(defaultCrmHeaderForPath("/crm/aprovacoes").title).toBe("Central de Aprovações");
    expect(defaultCrmHeaderForPath("/crm/configuracoes").title).toBe("Configurações");
  });

  it("rotas de detalhe usam o singular", () => {
    expect(defaultCrmHeaderForPath("/crm/leads/123").title).toBe("Lead");
    expect(defaultCrmHeaderForPath("/crm/pessoas/abc").title).toBe("Pessoa");
    expect(defaultCrmHeaderForPath("/crm/empresas/xyz").title).toBe("Empresa");
    expect(defaultCrmHeaderForPath("/crm/agentes/algum-slug").title).toBe("Agente IA");
    expect(defaultCrmHeaderForPath("/crm/parceiros/abc").title).toBe("Parceiro");
  });

  it("as rotas 'novo' têm título próprio (não o singular de detalhe)", () => {
    expect(defaultCrmHeaderForPath("/crm/parceiros/novo").title).toBe("Convidar Parceiro");
    expect(defaultCrmHeaderForPath("/crm/agentes/novo").title).toBe("Novo agente IA");
  });

  it("segmento desconhecido humaniza o slug", () => {
    expect(defaultCrmHeaderForPath("/crm/relatorio-custom").title).toBe("Relatorio Custom");
  });
});
