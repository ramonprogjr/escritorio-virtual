import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { registrarEvento } from "./registrar-evento";

const TENANT = "00000000-0000-4000-8000-000000000001";

/**
 * `registrarEvento` grava em `hub_eventos` (keystone F4 de KPIs/SLA). Contrato ABSOLUTO:
 * é observacional, best-effort — nunca pode lançar nem propagar erro para o fluxo de
 * negócio que a chamou (lead/atendimento/aprovação não podem cair por causa de um log).
 */
function makeSupabase(insertImpl: (row: Record<string, unknown>) => unknown) {
  const inserted: Record<string, unknown>[] = [];
  const client = {
    from: (tabela: string) => ({
      insert: (row: Record<string, unknown>) => {
        inserted.push({ tabela, ...row });
        return insertImpl(row);
      },
    }),
  };
  return { supabase: client as unknown as SupabaseClient, inserted };
}

describe("registrarEvento — instrumentação best-effort de hub_eventos", () => {
  it("sucesso: grava em hub_eventos com tenant_id sempre presente", async () => {
    const { supabase, inserted } = makeSupabase(() => Promise.resolve({ data: null, error: null }));

    await registrarEvento(supabase, {
      event_type: "lead_criado",
      entity_type: "lead",
      entity_id: "lead-1",
      lead_id: "lead-1",
      ator: "humano",
      payload: { origem: "site" },
      tenant_id: TENANT,
    });

    expect(inserted).toHaveLength(1);
    expect(inserted[0].tabela).toBe("hub_eventos");
    expect(inserted[0].event_type).toBe("lead_criado");
    expect(inserted[0].tenant_id).toBe(TENANT);
    expect(inserted[0].entity_id).toBe("lead-1");
  });

  it("erro genérico do insert (ex.: rede) — não lança, retorna silenciosamente", async () => {
    const { supabase } = makeSupabase(() =>
      Promise.resolve({ data: null, error: { message: "network error", code: "ECONNRESET" } })
    );

    await expect(
      registrarEvento(supabase, { event_type: "mensagem_enviada", tenant_id: TENANT })
    ).resolves.toBeUndefined();
  });

  it("exceção lançada pelo client (ex.: promise rejeitada) — não propaga", async () => {
    const client = {
      from: () => ({
        insert: () => {
          throw new Error("falha de rede simulada");
        },
      }),
    };

    await expect(
      registrarEvento(client as unknown as SupabaseClient, {
        event_type: "estagio_alterado",
        tenant_id: TENANT,
      })
    ).resolves.toBeUndefined();
  });

  it("promise rejeitada pelo client — não propaga", async () => {
    const { supabase } = makeSupabase(() => Promise.reject(new Error("timeout")));

    await expect(
      registrarEvento(supabase, { event_type: "aprovacao_decidida", tenant_id: TENANT })
    ).resolves.toBeUndefined();
  });

  it("coluna ausente (schema desatualizado, ex.: PGRST204) — tolera e não lança", async () => {
    const { supabase } = makeSupabase(() =>
      Promise.resolve({
        data: null,
        error: { message: "Could not find the 'ator' column of 'hub_eventos' in the schema cache", code: "PGRST204" },
      })
    );

    await expect(
      registrarEvento(supabase, {
        event_type: "lead_criado",
        ator: "sistema",
        tenant_id: TENANT,
      })
    ).resolves.toBeUndefined();
  });

  it("sem tenant_id explícito — ainda assim não lança (tenant_id vai null, best-effort)", async () => {
    const { supabase, inserted } = makeSupabase(() => Promise.resolve({ data: null, error: null }));

    await registrarEvento(supabase, { event_type: "lead_criado" });

    expect(inserted[0].tenant_id).toBeNull();
  });

  it("consumidor real (mock de vi.fn) confirma que a chamada nunca é aguardada como rejeição fatal", async () => {
    const insert = vi.fn().mockRejectedValue(new Error("boom"));
    const client = { from: () => ({ insert }) };

    await registrarEvento(client as unknown as SupabaseClient, {
      event_type: "mensagem_enviada",
      tenant_id: TENANT,
    });

    expect(insert).toHaveBeenCalledTimes(1);
  });
});
