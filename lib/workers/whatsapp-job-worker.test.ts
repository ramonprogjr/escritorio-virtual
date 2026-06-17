import { describe, expect, it } from "vitest";
import { resolverAgenteSlugDoJob } from "./whatsapp-job-worker";

describe("resolverAgenteSlugDoJob", () => {
  it("prioriza job.agente_slug", () => {
    const slug = resolverAgenteSlugDoJob(
      { agente_slug: "sdr" },
      { lead: { agente_responsavel: "outro" }, agente: { agente_slug: "terceiro" } }
    );
    expect(slug).toBe("sdr");
  });

  it("usa lead.agente_responsavel quando job não tem slug", () => {
    const slug = resolverAgenteSlugDoJob(
      { agente_slug: null },
      { lead: { agente_responsavel: "wendel" }, agente: { agente_slug: "sdr" } }
    );
    expect(slug).toBe("wendel");
  });

  it("usa contexto.agente como fallback", () => {
    const slug = resolverAgenteSlugDoJob(
      { agente_slug: "" },
      { lead: {}, agente: { agente_slug: "sdr" } }
    );
    expect(slug).toBe("sdr");
  });

  it("retorna vazio sem slug resolvível", () => {
    expect(resolverAgenteSlugDoJob({ agente_slug: null }, { lead: {}, agente: null })).toBe("");
  });
});
