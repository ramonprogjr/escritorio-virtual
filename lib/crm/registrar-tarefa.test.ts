import { describe, expect, it, vi } from "vitest";
import { montarLinhaTarefa, criarTarefa } from "./registrar-tarefa";

const TENANT = "00000000-0000-4000-8000-000000000001";

describe("montarLinhaTarefa — resolução de entity + validação", () => {
  it("resolve entity a partir de lead_id quando entity_type não vem", () => {
    const l = montarLinhaTarefa({ titulo: "Ligar", lead_id: "lead-1", tenant_id: TENANT }) as Record<string, unknown>;
    expect(l.entity_type).toBe("lead");
    expect(l.entity_id).toBe("lead-1");
    expect(l.lead_id).toBe("lead-1");
  });
  it("resolve entity a partir de negocio_id", () => {
    const l = montarLinhaTarefa({ titulo: "Fechar", negocio_id: "neg-1", tenant_id: TENANT }) as Record<string, unknown>;
    expect(l.entity_type).toBe("negocio");
    expect(l.entity_id).toBe("neg-1");
  });
  it("aceita entity genérica (fornecedor) sem lead/negócio", () => {
    const l = montarLinhaTarefa({ titulo: "Homologar", entity_type: "fornecedor", entity_id: "f-1", tenant_id: TENANT }) as Record<string, unknown>;
    expect(l.entity_type).toBe("fornecedor");
    expect(l.entity_id).toBe("f-1");
    expect(l.lead_id).toBeNull();
    expect(l.negocio_id).toBeNull();
  });
  it("normaliza prioridade inválida para media e status aberta", () => {
    const l = montarLinhaTarefa({ titulo: "X", prioridade: "urgentíssima", tenant_id: TENANT }) as Record<string, unknown>;
    expect(l.prioridade).toBe("media");
    expect(l.status).toBe("aberta");
  });
  it("origem ia é preservada; default humano", () => {
    expect((montarLinhaTarefa({ titulo: "X", origem: "ia", tenant_id: TENANT }) as Record<string, unknown>).origem).toBe("ia");
    expect((montarLinhaTarefa({ titulo: "X", tenant_id: TENANT }) as Record<string, unknown>).origem).toBe("humano");
  });
  it("vencimento inválido vira null; ISO válido normaliza", () => {
    expect((montarLinhaTarefa({ titulo: "X", vencimento_em: "não-é-data", tenant_id: TENANT }) as Record<string, unknown>).vencimento_em).toBeNull();
    const l = montarLinhaTarefa({ titulo: "X", vencimento_em: "2026-07-10T09:00:00-03:00", tenant_id: TENANT }) as Record<string, unknown>;
    expect(typeof l.vencimento_em).toBe("string");
  });
  it("título vazio → erro; sem tenant → erro", () => {
    expect(montarLinhaTarefa({ titulo: "  ", tenant_id: TENANT })).toEqual({ erro: "título obrigatório" });
    expect(montarLinhaTarefa({ titulo: "X", tenant_id: "" })).toEqual({ erro: "tenant_id obrigatório" });
  });
});

describe("criarTarefa — insere e loga evento", () => {
  function mockSupabase(insertResult: { data?: unknown; error?: unknown }) {
    const eventos: Record<string, unknown>[] = [];
    const q: Record<string, unknown> = {};
    let lastTable = "";
    let lastInsert: unknown = null;
    q.from = (t: string) => { lastTable = t; return q; };
    q.insert = (row: unknown) => {
      if (lastTable === "hub_eventos") { eventos.push(row as Record<string, unknown>); return Promise.resolve({ error: null }); }
      lastInsert = row;
      return q;
    };
    q.select = () => q;
    q.single = () => Promise.resolve(insertResult);
    return { supabase: q as never, eventos, getInsert: () => lastInsert };
  }

  it("cria a tarefa e emite evento tarefa_criada", async () => {
    const { supabase, eventos, getInsert } = mockSupabase({ data: { id: "t-1" }, error: null });
    const r = await criarTarefa(supabase, { titulo: "Ligar amanhã", lead_id: "lead-9", origem: "ia", tenant_id: TENANT });
    expect(r).toEqual({ ok: true, id: "t-1" });
    expect((getInsert() as Record<string, unknown>).titulo).toBe("Ligar amanhã");
    expect(eventos).toHaveLength(1);
    expect(eventos[0].event_type).toBe("tarefa_criada");
    expect((eventos[0].payload as Record<string, unknown>).tarefa_id).toBe("t-1");
  });

  it("propaga erro de insert sem logar evento", async () => {
    const { supabase, eventos } = mockSupabase({ data: null, error: { message: "boom" } });
    const r = await criarTarefa(supabase, { titulo: "X", tenant_id: TENANT });
    expect(r).toEqual({ ok: false, error: "boom" });
    expect(eventos).toHaveLength(0);
  });
});
