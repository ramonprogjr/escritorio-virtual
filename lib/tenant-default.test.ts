import { describe, expect, it } from "vitest";
import { DEFAULT_OBRA10_TENANT_ID, tenantScopeExact, tenantScopeOrFilter } from "@/lib/tenant-default";

// Trava a distincao CRITICA de seguranca (ver docs/AUDITORIA-TENANT-NULL-LEAK-05JUL):
// - tenantScopeExact  = tabela PRIVADA -> NUNCA inclui tenant_id NULL.
// - tenantScopeOrFilter = master-data GLOBAL -> inclui is.null DE PROPOSITO.
// Se alguem trocar um pelo outro numa tabela privada, reintroduz vazamento cross-tenant.

const TID = "11111111-1111-4111-8111-111111111111";

describe("tenantScopeExact (tabela privada — seguro)", () => {
  it("retorna o tenant exato, sem NULL", () => {
    const s = tenantScopeExact(TID);
    expect(s).toBe(TID);
    expect(s).not.toContain("null");
  });
  it("cai no default Obra10 quando vazio/espacos", () => {
    expect(tenantScopeExact("")).toBe(DEFAULT_OBRA10_TENANT_ID);
    expect(tenantScopeExact("   ")).toBe(DEFAULT_OBRA10_TENANT_ID);
  });
});

describe("tenantScopeOrFilter (master-data global — inclui NULL de proposito)", () => {
  it("SEMPRE inclui tenant_id.is.null (por isso NAO serve p/ tabela privada)", () => {
    expect(tenantScopeOrFilter(TID)).toContain("tenant_id.is.null");
  });
  it("inclui o tenant pedido E o default Obra10", () => {
    const s = tenantScopeOrFilter(TID);
    expect(s).toContain(`tenant_id.eq.${TID}`);
    expect(s).toContain(`tenant_id.eq.${DEFAULT_OBRA10_TENANT_ID}`);
  });
  it("quando o tenant JA e o default, nao duplica o eq", () => {
    const s = tenantScopeOrFilter(DEFAULT_OBRA10_TENANT_ID);
    const count = s.split(`tenant_id.eq.${DEFAULT_OBRA10_TENANT_ID}`).length - 1;
    expect(count).toBe(1);
    expect(s).toContain("tenant_id.is.null");
  });
});
