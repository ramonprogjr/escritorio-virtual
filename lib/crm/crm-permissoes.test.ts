import { describe, expect, it } from "vitest";
import {
  crmNivelFromRole,
  crmNivelAtLeast,
  isCrmOwnerRole,
  isCrmGestorRole,
  crmPode,
  crmPodeAtribuirRole,
  crmPodeEditarPapelUtilizador,
  crmPodeAlterarStatusUtilizador,
  isCrmOwnerFixo,
  crmMinNivelParaRota,
  crmPodeVerRota,
  crmRotaInicial,
} from "./crm-permissoes";

describe("crmNivelFromRole — normaliza papéis (inclui legado)", () => {
  it("mapeia papéis canônicos e legados", () => {
    expect(crmNivelFromRole("owner")).toBe("owner");
    expect(crmNivelFromRole("admin")).toBe("gestor"); // legado
    expect(crmNivelFromRole("vendedor")).toBe("comercial"); // legado
    expect(crmNivelFromRole("financeiro")).toBe("financeiro");
    expect(crmNivelFromRole("atendente")).toBe("atendente");
  });
  it("case-insensitive e com espaços", () => {
    expect(crmNivelFromRole("  OWNER ")).toBe("owner");
    expect(crmNivelFromRole("Gestor")).toBe("gestor");
  });
  it("parceiro e desconhecido → null (sem acesso CRM)", () => {
    expect(crmNivelFromRole("parceiro")).toBeNull();
    expect(crmNivelFromRole("xpto")).toBeNull();
    expect(crmNivelFromRole(null)).toBeNull();
    expect(crmNivelFromRole(undefined)).toBeNull();
  });
});

describe("hierarquia de níveis", () => {
  it("crmNivelAtLeast respeita o rank", () => {
    expect(crmNivelAtLeast("owner", "gestor")).toBe(true);
    expect(crmNivelAtLeast("atendente", "comercial")).toBe(false);
    expect(crmNivelAtLeast("financeiro", "financeiro")).toBe(true);
    expect(crmNivelAtLeast("parceiro", "atendente")).toBe(false);
  });
  it("isCrmOwnerRole / isCrmGestorRole", () => {
    expect(isCrmOwnerRole("owner")).toBe(true);
    expect(isCrmOwnerRole("gestor")).toBe(false);
    expect(isCrmGestorRole("owner")).toBe(true);
    expect(isCrmGestorRole("admin")).toBe(true); // legado→gestor
    expect(isCrmGestorRole("comercial")).toBe(false);
  });
});

describe("crmPode — permissões por ação", () => {
  it("owner pode tudo (*)", () => {
    expect(crmPode("owner", "crm:gerir_equipa")).toBe(true);
    expect(crmPode("owner", "qualquer:coisa")).toBe(true);
  });
  it("atendente não edita; financeiro tem módulo financeiro", () => {
    expect(crmPode("atendente", "crm:editar")).toBe(false);
    expect(crmPode("atendente", "crm:atendimento")).toBe(true);
    expect(crmPode("financeiro", "crm:financeiro")).toBe(true);
    expect(crmPode("financeiro", "crm:editar")).toBe(false);
  });
  it("parceiro/desconhecido cai em leitura", () => {
    expect(crmPode("parceiro", "crm:ler")).toBe(true);
    expect(crmPode("parceiro", "crm:editar")).toBe(false);
  });
});

describe("anti-escalada de papel", () => {
  it("ninguém atribui owner; owner/gestor atribuem abaixo", () => {
    expect(crmPodeAtribuirRole("owner", "owner")).toBe(false);
    expect(crmPodeAtribuirRole("owner", "gestor")).toBe(true);
    expect(crmPodeAtribuirRole("gestor", "comercial")).toBe(true);
    expect(crmPodeAtribuirRole("comercial", "atendente")).toBe(false); // comercial não atribui
    expect(crmPodeAtribuirRole("atendente", "atendente")).toBe(false);
  });
  it("owner fixo (allowlist) é intocável em editar/desativar", () => {
    expect(isCrmOwnerFixo("nice.engemp@gmail.com", "owner")).toBe(true);
    expect(crmPodeEditarPapelUtilizador("owner", "nice.engemp@gmail.com", "owner")).toBe(false);
    expect(crmPodeAlterarStatusUtilizador("owner", "nice.engemp@gmail.com", "owner")).toBe(false);
  });
  it("gestor não edita owner; gestor edita comercial; comercial não edita ninguém", () => {
    expect(crmPodeEditarPapelUtilizador("gestor", "x@y.com", "owner")).toBe(false);
    expect(crmPodeEditarPapelUtilizador("gestor", "x@y.com", "comercial")).toBe(true);
    expect(crmPodeEditarPapelUtilizador("comercial", "x@y.com", "atendente")).toBe(false);
  });
});

describe("controle de rota por nível", () => {
  it("rotas owner-only e mínimos", () => {
    expect(crmMinNivelParaRota("/crm/empresas")).toBe("owner");
    expect(crmMinNivelParaRota("/crm/integracoes")).toBe("owner");
    expect(crmMinNivelParaRota("/crm/usuarios")).toBe("gestor");
    expect(crmMinNivelParaRota("/crm/leads")).toBe("atendente");
    expect(crmMinNivelParaRota("/crm")).toBe("financeiro");
  });
  it("ignora query string e usa default comercial p/ rota não listada", () => {
    expect(crmMinNivelParaRota("/crm/leads?x=1")).toBe("atendente");
    expect(crmMinNivelParaRota("/crm/negocios")).toBe("comercial");
  });
  it("crmPodeVerRota respeita o mínimo", () => {
    expect(crmPodeVerRota("atendente", "/crm/leads")).toBe(true);
    expect(crmPodeVerRota("atendente", "/crm/empresas")).toBe(false);
    expect(crmPodeVerRota("owner", "/crm/empresas")).toBe(true);
    expect(crmPodeVerRota("parceiro", "/crm/leads")).toBe(false);
  });
  it("crmRotaInicial: atendente vai p/ inbox", () => {
    expect(crmRotaInicial("atendente")).toBe("/crm/atendimento");
    expect(crmRotaInicial("owner")).toBe("/crm");
    expect(crmRotaInicial("gestor")).toBe("/crm");
  });
});

// ── Cobertura dos casos que faltavam (destravamento 05/jul): o 403 real era com os
// papeis EN INTERNOS, e as duas regras ORTOGONAIS (financeiro exato + escrow). ──

describe("crmNivelFromRole — papeis EN INTERNOS ganham nivel (fix REAL do 403)", () => {
  it("commercial/operation/architect/financial NAO caem mais em null", () => {
    expect(crmNivelFromRole("commercial")).toBe("comercial");
    expect(crmNivelFromRole("operation")).toBe("comercial");
    expect(crmNivelFromRole("architect")).toBe("comercial");
    expect(crmNivelFromRole("financial")).toBe("financeiro");
  });
  it("EN externos + ai_agent seguem null (invariante fail-closed)", () => {
    for (const r of ["supplier", "broker", "real_estate", "client", "ai_agent"]) {
      expect(crmNivelFromRole(r)).toBeNull();
    }
  });
});

describe("crmPodeVerRota — /crm/financeiro por CONJUNTO EXATO (nao rank)", () => {
  it("financeiro/gestor/owner entram; comercial (rank acima) NAO", () => {
    expect(crmPodeVerRota("financial", "/crm/financeiro")).toBe(true);
    expect(crmPodeVerRota("gestor", "/crm/financeiro")).toBe(true);
    expect(crmPodeVerRota("owner", "/crm/financeiro")).toBe(true);
    // comercial supera financeiro no rank, mas financeiro e funcao ortogonal:
    expect(crmPodeVerRota("commercial", "/crm/financeiro")).toBe(false);
  });
});

describe("crmPodeVerRota — escrow em /crm/aprovacoes (capability, NAO nivel)", () => {
  it("architect/operation (nivel comercial) alcancam a fila p/ assinar a chave tecnica", () => {
    expect(crmPodeVerRota("architect", "/crm/aprovacoes")).toBe(true);
    expect(crmPodeVerRota("operation", "/crm/aprovacoes")).toBe(true);
  });
  it("comercial SEM chave de escrow NAO entra; gestor entra por nivel", () => {
    expect(crmPodeVerRota("commercial", "/crm/aprovacoes")).toBe(false);
    expect(crmPodeVerRota("gestor", "/crm/aprovacoes")).toBe(true);
  });
});
