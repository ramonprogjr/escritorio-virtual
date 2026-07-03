import { describe, expect, it } from "vitest";
import {
  APP_ROLES,
  ROLE_MAP,
  normalizeRole,
  roleDef,
  rbacPersonaForRole,
  roleTemCapacidade,
  crmNivelForRole,
} from "./role-map";
import { crmNivelFromRole } from "@/lib/crm/crm-permissoes";
import { personaCockpitFromRole } from "@/lib/crm/persona-cockpit";

describe("role-map — cobertura dos 13 papéis canônicos", () => {
  it("todos os 13 valores do enum têm entrada", () => {
    expect(APP_ROLES).toHaveLength(13);
    for (const r of APP_ROLES) expect(ROLE_MAP[r]).toBeTruthy();
  });

  it("nível/persona/escopo por papel (matriz do dono)", () => {
    expect(ROLE_MAP.owner).toMatchObject({ nivel: "owner", persona: "hub-auditor", escopo_tenant: "hub" });
    expect(ROLE_MAP.admin).toMatchObject({ nivel: "gestor", persona: "hub-auditor", escopo_tenant: "hub" });
    expect(ROLE_MAP.super_admin).toMatchObject({ persona: "hub-auditor", escopo_tenant: "plataforma" });
    expect(ROLE_MAP.admin_hub).toMatchObject({ persona: "hub-auditor", escopo_tenant: "plataforma" });
    expect(ROLE_MAP.commercial).toMatchObject({ nivel: "operar", persona: "comercial" });
    expect(ROLE_MAP.financial).toMatchObject({ nivel: "operar", persona: "financeiro" });
    expect(ROLE_MAP.operation).toMatchObject({ persona: "engenharia" });
    expect(ROLE_MAP.architect).toMatchObject({ persona: "arquiteto" });
    expect(ROLE_MAP.supplier).toMatchObject({ nivel: null, persona: "fornecedor" });
    expect(ROLE_MAP.broker).toMatchObject({ nivel: null, persona: "parceiro" });
    expect(ROLE_MAP.real_estate).toMatchObject({ nivel: null, persona: "parceiro" });
    expect(ROLE_MAP.client).toMatchObject({ nivel: null, persona: "cliente", escopo_tenant: "guest" });
    expect(ROLE_MAP.ai_agent).toMatchObject({ nivel: null, persona: "restrito" });
  });

  it("papéis EXTERNOS + ai_agent têm nivel null (invariante b)", () => {
    for (const r of ["supplier", "broker", "real_estate", "client", "ai_agent"]) {
      expect(ROLE_MAP[r as (typeof APP_ROLES)[number]].nivel).toBeNull();
    }
  });
});

describe("role-map — capacidades do escrow (fonte única das 2 chaves)", () => {
  it("owner é a Chave Hub; NÃO é a Chave Técnica", () => {
    expect(roleTemCapacidade("owner", "escrow:chave_hub")).toBe(true);
    expect(roleTemCapacidade("owner", "escrow:chave_tecnica")).toBe(false);
  });
  it("architect e operation são a Chave Técnica; NÃO são a Chave Hub", () => {
    for (const r of ["architect", "operation"]) {
      expect(roleTemCapacidade(r, "escrow:chave_tecnica")).toBe(true);
      expect(roleTemCapacidade(r, "escrow:chave_hub")).toBe(false);
    }
  });
  it("admin / admin_hub / super_admin NÃO seguram NENHUMA chave", () => {
    for (const r of ["admin", "admin_hub", "super_admin"]) {
      expect(roleTemCapacidade(r, "escrow:chave_hub")).toBe(false);
      expect(roleTemCapacidade(r, "escrow:chave_tecnica")).toBe(false);
    }
  });
  it("financial vê ledger (financeiro:ler) mas NÃO é chave (D6)", () => {
    expect(roleTemCapacidade("financial", "financeiro:ler")).toBe(true);
    expect(roleTemCapacidade("financial", "escrow:chave_hub")).toBe(false);
    expect(roleTemCapacidade("financial", "escrow:chave_tecnica")).toBe(false);
  });
  it("ai_agent NUNCA segura chave de dinheiro (invariante g)", () => {
    expect(roleTemCapacidade("ai_agent", "escrow:chave_hub")).toBe(false);
    expect(roleTemCapacidade("ai_agent", "escrow:chave_tecnica")).toBe(false);
  });
  it("papel desconhecido → nenhuma capacidade (fail-closed)", () => {
    expect(roleTemCapacidade("xpto", "escrow:chave_hub")).toBe(false);
    expect(roleTemCapacidade(null, "escrow:chave_tecnica")).toBe(false);
  });
});

describe("role-map — normalização PT/legado (sinônimos depreciados)", () => {
  it("dobra PT → canônico inglês", () => {
    expect(normalizeRole("comercial")).toBe("commercial");
    expect(normalizeRole("vendedor")).toBe("commercial");
    expect(normalizeRole("financeiro")).toBe("financial");
    expect(normalizeRole("gestor")).toBe("admin");
    expect(normalizeRole("arquiteto")).toBe("architect");
    expect(normalizeRole("engenharia")).toBe("operation");
    expect(normalizeRole("parceiro")).toBe("broker");
  });
  it("case-insensitive + espaços; desconhecido/ausente → null", () => {
    expect(normalizeRole("  ARCHITECT ")).toBe("architect");
    expect(normalizeRole("xpto")).toBeNull();
    expect(normalizeRole(null)).toBeNull();
    expect(normalizeRole(undefined)).toBeNull();
  });
  it("papel desconhecido cai em restrito (fail-closed) no roleDef", () => {
    expect(roleDef("xpto")).toMatchObject({ nivel: null, persona: "restrito", capacidades: [] });
  });
});

describe("role-map — ponte crmNivelForRole (destrava 403 EN, preserva PT)", () => {
  it("PT/legado preservado 1:1 (SEM regressão)", () => {
    expect(crmNivelForRole("owner")).toBe("owner");
    expect(crmNivelForRole("admin")).toBe("gestor");
    expect(crmNivelForRole("gestor")).toBe("gestor");
    expect(crmNivelForRole("comercial")).toBe("comercial");
    expect(crmNivelForRole("vendedor")).toBe("comercial");
    expect(crmNivelForRole("financeiro")).toBe("financeiro");
    expect(crmNivelForRole("finance")).toBe("financeiro");
    expect(crmNivelForRole("atendente")).toBe("atendente");
    expect(crmNivelForRole("parceiro")).toBeNull();
    expect(crmNivelForRole("xpto")).toBeNull();
  });
  it("papéis EN internos PARAM de retornar null (bug vivo da Ariane)", () => {
    expect(crmNivelForRole("commercial")).toBe("comercial"); // Ariane
    expect(crmNivelForRole("financial")).toBe("financeiro");
    // operation/architect = "comercial" (NÃO gestor): fecham o 403 SEM ganhar as rotas
    // de admin/financeiro do gestor. Alcançam a fila de aprovação por CAPABILITY (escrow).
    expect(crmNivelForRole("operation")).toBe("comercial");
    expect(crmNivelForRole("architect")).toBe("comercial");
    expect(crmNivelForRole("super_admin")).toBe("gestor");
    expect(crmNivelForRole("admin_hub")).toBe("gestor");
  });
  it("EXTERNOS + ai_agent seguem null na escala CRM (invariante b)", () => {
    for (const r of ["supplier", "broker", "real_estate", "client", "ai_agent"]) {
      expect(crmNivelForRole(r)).toBeNull();
    }
  });
  it("crmNivelFromRole (crm-permissoes) delega ao mesmo mapa", () => {
    expect(crmNivelFromRole("commercial")).toBe("comercial");
    expect(crmNivelFromRole("architect")).toBe("comercial");
    expect(crmNivelFromRole("client")).toBeNull();
  });
});

describe("role-map — persona de cockpit derivada do mesmo mapa", () => {
  it("rbacPersonaForRole rico + colapso p/ o cockpit de 5 tipos", () => {
    expect(rbacPersonaForRole("operation")).toBe("engenharia");
    expect(rbacPersonaForRole("architect")).toBe("arquiteto");
    expect(rbacPersonaForRole("client")).toBe("cliente");
    expect(rbacPersonaForRole("broker")).toBe("parceiro");
    expect(rbacPersonaForRole("xpto")).toBe("restrito");
  });
  it("personaCockpitFromRole preserva comercial e mapeia as personas de UI", () => {
    // comercial e Hub preservados no dashboard atual.
    for (const r of ["owner", "admin", "commercial", "financial", "gestor", "atendente"]) {
      expect(personaCockpitFromRole(r)).toBe("comercial");
    }
    expect(personaCockpitFromRole("operation")).toBe("engenharia");
    expect(personaCockpitFromRole("architect")).toBe("arquiteto");
    expect(personaCockpitFromRole("client")).toBe("cliente");
    expect(personaCockpitFromRole("supplier")).toBe("fornecedor");
    // CORREÇÃO do vazamento: broker/real_estate deixam o dashboard COMPLETO → cockpit externo.
    expect(personaCockpitFromRole("broker")).toBe("fornecedor");
    expect(personaCockpitFromRole("real_estate")).toBe("fornecedor");
    // parceiro (PT) preservado no fornecedor.
    expect(personaCockpitFromRole("parceiro")).toBe("fornecedor");
  });
});
