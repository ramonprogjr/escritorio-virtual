import { describe, expect, it } from "vitest";
import { personaCockpitFromRole } from "@/lib/crm/persona-cockpit";

/**
 * R7: o cockpit persona-aware deve ser FAIL-CLOSED — um papel desconhecido/typo NUNCA
 * pode cair no dashboard comercial completo do Hub (vazamento de visão gerencial).
 */
describe("personaCockpitFromRole — mapeamento + R7 fail-closed", () => {
  it("papéis reais (EN) mapeiam ao cockpit certo", () => {
    expect(personaCockpitFromRole("commercial")).toBe("comercial");
    expect(personaCockpitFromRole("operation")).toBe("engenharia");
    expect(personaCockpitFromRole("architect")).toBe("arquiteto");
    expect(personaCockpitFromRole("client")).toBe("cliente");
    expect(personaCockpitFromRole("supplier")).toBe("fornecedor");
  });

  it("R7: papel desconhecido/vazio/null NÃO cai no dashboard comercial (fail-closed)", () => {
    expect(personaCockpitFromRole("xpto_inexistente")).not.toBe("comercial");
    expect(personaCockpitFromRole("")).not.toBe("comercial");
    expect(personaCockpitFromRole(null)).not.toBe("comercial");
    expect(personaCockpitFromRole(undefined)).not.toBe("comercial");
    // Hoje o alvo é o cockpit externo restrito (Onda 1c troca por tela neutra dedicada).
    expect(personaCockpitFromRole("xpto_inexistente")).toBe("fornecedor");
  });
});
