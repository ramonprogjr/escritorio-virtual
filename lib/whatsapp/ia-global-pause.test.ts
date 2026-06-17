import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lerPausaGlobalAgente, revalidarPausaGlobalAntesProcessor } from "./ia-global-pause";

function mockSupabasePause(paused: boolean): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: paused
              ? {
                  ia_whatsapp_pausada: true,
                  ia_pausada_em: "2026-06-16T12:00:00.000Z",
                  ia_pausada_por: "wendel",
                  ia_pausada_motivo: "whatsapp_comando_ia_off",
                }
              : {
                  ia_whatsapp_pausada: false,
                  ia_pausada_em: null,
                  ia_pausada_por: null,
                  ia_pausada_motivo: null,
                },
            error: null,
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe("revalidarPausaGlobalAntesProcessor", () => {
  it("descarta job quando linha está pausada globalmente", async () => {
    const supabase = mockSupabasePause(true);
    const r = await revalidarPausaGlobalAntesProcessor(supabase, "sdr");
    expect(r.pausada).toBe(true);
    expect(r.lastError).toBe("ia_global_pausada");
  });

  it("permite processamento quando linha está ativa", async () => {
    const supabase = mockSupabasePause(false);
    const r = await revalidarPausaGlobalAntesProcessor(supabase, "sdr");
    expect(r.pausada).toBe(false);
    expect(r.lastError).toBeNull();
  });

  it("slug vazio não pausa", async () => {
    const supabase = mockSupabasePause(true);
    const state = await lerPausaGlobalAgente(supabase, "");
    expect(state.pausada).toBe(false);
    const r = await revalidarPausaGlobalAntesProcessor(supabase, "  ");
    expect(r.pausada).toBe(false);
  });
});
