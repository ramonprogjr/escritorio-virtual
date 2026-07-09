import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  verificarPausaAtendimento,
  comDdi55,
  parseComandoPausa,
  invalidarCachePausas,
  invalidarCacheAgentePausa,
} from "./pausa-atendimento";
import { telefoneConversaId } from "@/lib/crm/isolamento-conversa-lead";

/**
 * Testes do gate central de PAUSA (laudo Fable 09/jul §4). Cobrem: equivalência sufixo-11/DDI,
 * ordem+curto-circuito dos gates, fail-CLOSED em erro de banco, cache SÓ de positivos, trava
 * temporal (golive) + override ia_liberada, e o regex do comando /pausa.
 */

type SupaGate = Parameters<typeof verificarPausaAtendimento>[0];

/** Mock encadeável from/select/eq/limit/maybeSingle com data/error por tabela + contador de consultas. */
function makeSupabase(cfg: {
  agente?: { data?: unknown; error?: unknown };
  pausas?: { data?: unknown; error?: unknown };
}) {
  const counts = { hub_agente_identidade: 0, hub_atendimento_pausas: 0 };
  let table = "";
  const q: Record<string, unknown> = {};
  q.from = (t: string) => {
    table = t;
    return q;
  };
  q.select = () => q;
  q.eq = () => q;
  q.limit = () => q;
  q.maybeSingle = () => {
    if (table === "hub_agente_identidade") {
      counts.hub_agente_identidade++;
      return Promise.resolve(cfg.agente ?? { data: null, error: null });
    }
    if (table === "hub_atendimento_pausas") {
      counts.hub_atendimento_pausas++;
      return Promise.resolve(cfg.pausas ?? { data: null, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  };
  return { supabase: q as unknown as SupaGate, counts };
}

beforeEach(() => {
  invalidarCachePausas();
  invalidarCacheAgentePausa();
  delete process.env.IA_GOLIVE_AT;
});
afterEach(() => {
  delete process.env.IA_GOLIVE_AT;
});

describe("comDdi55 — sem DDI assume 55 (casa telefone fixo de 10 dígitos)", () => {
  it("fixo de 10 dígitos ganha 55", () => {
    expect(comDdi55("1133334444")).toBe("551133334444");
  });
  it("celular de 11 dígitos ganha 55", () => {
    expect(comDdi55("11973404228")).toBe("5511973404228");
  });
  it("já com DDI (12/13 dígitos) não muda", () => {
    expect(comDdi55("551133334444")).toBe("551133334444");
    expect(comDdi55("5511973404228")).toBe("5511973404228");
  });
  it("o sufixo-11 do fixo com 55 bate com o inbound (o furo que o fix conserta)", () => {
    const suf = (t: string) => (t.length >= 11 ? t.slice(-11) : t);
    expect(suf(comDdi55("1133334444"))).toBe(suf("551133334444"));
  });
});

describe("parseComandoPausa — regex do comando do celular", () => {
  const chat = "5511999999999";
  it('"/pausa" sozinho pausa o chat atual', () => {
    expect(parseComandoPausa("/pausa", chat)).toEqual({ acao: "pausa", alvo: chat });
  });
  it("é case-insensitive e tolera espaços nas bordas", () => {
    expect(parseComandoPausa("/PAUSA", chat)?.acao).toBe("pausa");
    expect(parseComandoPausa("  /retoma  ", chat)).toEqual({ acao: "retoma", alvo: chat });
  });
  it('"/pausar" NÃO casa (word boundary)', () => {
    expect(parseComandoPausa("/pausar", chat)).toBeNull();
  });
  it("só casa no INÍCIO da mensagem (anti prompt-injection no meio do texto)", () => {
    expect(parseComandoPausa("oi /pausa", chat)).toBeNull();
  });
  it('"/pausa 11 98888-7777" extrai o número citado', () => {
    const cmd = parseComandoPausa("/pausa 11 98888-7777", chat);
    expect(cmd?.acao).toBe("pausa");
    expect(cmd?.alvo).toBe(telefoneConversaId("11988887777"));
  });
});

describe("verificarPausaAtendimento — ordem, curto-circuito e segurança", () => {
  it("agente pausado (pânico) → pausa e NÃO consulta a deny-list", async () => {
    const { supabase, counts } = makeSupabase({ agente: { data: { ia_whatsapp_pausada: true }, error: null } });
    const r = await verificarPausaAtendimento(supabase, { telefone: "5511900000001", agenteSlug: "maria" });
    expect(r.pausada).toBe(true);
    expect(r.fonte).toBe("painel");
    expect(counts.hub_atendimento_pausas).toBe(0);
  });

  it("deny-list encontrada → pausa com a fonte da linha", async () => {
    const { supabase } = makeSupabase({ pausas: { data: { fonte: "etiqueta", motivo: "etiqueta:pausa" }, error: null } });
    const r = await verificarPausaAtendimento(supabase, { telefone: "5511900000002", agenteSlug: null });
    expect(r.pausada).toBe(true);
    expect(r.fonte).toBe("etiqueta");
  });

  it("nada pausa + sem golive → responde (não bloqueia lead bom)", async () => {
    const { supabase } = makeSupabase({});
    const r = await verificarPausaAtendimento(supabase, { telefone: "5511900000003", agenteSlug: "maria" });
    expect(r.pausada).toBe(false);
  });

  it("FAIL-CLOSED: erro ao ler o agente LANÇA (worker faz retry, silêncio seguro)", async () => {
    const { supabase } = makeSupabase({ agente: { data: null, error: { message: "db down" } } });
    await expect(
      verificarPausaAtendimento(supabase, { telefone: "5511900000004", agenteSlug: "maria" })
    ).rejects.toThrow();
  });

  it("FAIL-CLOSED: erro ao ler a deny-list LANÇA", async () => {
    const { supabase } = makeSupabase({ agente: { data: null, error: null }, pausas: { data: null, error: { message: "timeout" } } });
    await expect(
      verificarPausaAtendimento(supabase, { telefone: "5511900000005", agenteSlug: null })
    ).rejects.toThrow();
  });

  it("cache SÓ de positivos: negativo re-consulta o banco (fecha janela pós-/pausa)", async () => {
    const { supabase, counts } = makeSupabase({});
    await verificarPausaAtendimento(supabase, { telefone: "5511900000006", agenteSlug: null });
    await verificarPausaAtendimento(supabase, { telefone: "5511900000006", agenteSlug: null });
    expect(counts.hub_atendimento_pausas).toBe(2);
  });

  it("cache de positivo evita a 2ª consulta", async () => {
    const { supabase, counts } = makeSupabase({ pausas: { data: { fonte: "seed", motivo: "cliente_ativo" }, error: null } });
    const tel = "5511900000007";
    await verificarPausaAtendimento(supabase, { telefone: tel, agenteSlug: null });
    await verificarPausaAtendimento(supabase, { telefone: tel, agenteSlug: null });
    expect(counts.hub_atendimento_pausas).toBe(1);
  });

  it("trava temporal: lead pré-golive pausa; override ia_liberada e lead pós-golive respondem", async () => {
    process.env.IA_GOLIVE_AT = "2026-07-09T07:00:00-03:00";
    const { supabase } = makeSupabase({});
    const pre = await verificarPausaAtendimento(supabase, {
      telefone: "5511900000008",
      agenteSlug: null,
      leadCriadoEm: "2026-07-01T10:00:00-03:00",
    });
    expect(pre.pausada).toBe(true);
    expect(pre.fonte).toBe("temporal");

    const liberado = await verificarPausaAtendimento(supabase, {
      telefone: "5511900000009",
      agenteSlug: null,
      leadCriadoEm: "2026-07-01T10:00:00-03:00",
      leadMetadata: { ia_liberada: true },
    });
    expect(liberado.pausada).toBe(false);

    const pos = await verificarPausaAtendimento(supabase, {
      telefone: "5511900000010",
      agenteSlug: null,
      leadCriadoEm: "2026-07-09T09:00:00-03:00",
    });
    expect(pos.pausada).toBe(false);
  });

  it("IA_GOLIVE_AT inválida NÃO bloqueia (trava desligada, avisada)", async () => {
    process.env.IA_GOLIVE_AT = "não-é-data";
    const { supabase } = makeSupabase({});
    const r = await verificarPausaAtendimento(supabase, {
      telefone: "5511900000011",
      agenteSlug: null,
      leadCriadoEm: "2026-07-01T10:00:00-03:00",
    });
    expect(r.pausada).toBe(false);
  });
});
