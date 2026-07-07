import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { derivarEntregaDoNegocio } from "./derivar-entrega";
import { ENTREGA_OBRA, ENTREGA_POR_MERCADO, type TipoDerivado } from "./derivar-negocio";

/**
 * EST-03 — esteira de entrega vs. CHECK de `hub_atividades`.
 *
 * O CHECK de `hub_atividades.tipo`/`feito_por_tipo` vive em PRODUÇÃO mas a migração
 * não o reproduz (schema-nao-reproduzivel). Este allowlist é o ESPELHO do enum de
 * produção que a esteira PODE emitir. Se `derivarEntregaDoNegocio` passar a gravar
 * um valor fora daqui, o CI trava — forçando estender o CHECK do banco JUNTO (regra
 * de processo do EST-03), em vez de a produção quebrar em silêncio.
 */
const TIPO_SEGURO = new Set(["status_change"]);
const FEITO_POR_TIPO_SEGURO = new Set(["ia", "humano"]);

type MockOpts = { atividadeError?: { message: string } | null };

/** Supabase mínimo e encadeável: só o que a esteira exercita. */
function mockSupabase(
  negocio: Record<string, unknown>,
  { atividadeError = null }: MockOpts = {}
) {
  const atividadeInserts: Record<string, unknown>[] = [];

  const from = (table: string) => {
    let terminal: { data: unknown; error: unknown } = { data: null, error: null };
    const b: Record<string, unknown> = {};
    const self = () => b;
    b.select = self;
    b.eq = self;
    b.limit = self;
    b.order = self;
    b.insert = (row: Record<string, unknown>) => {
      if (table === "hub_atividades") {
        atividadeInserts.push(row);
        terminal = { data: null, error: atividadeError };
      }
      return b;
    };
    b.maybeSingle = () =>
      table === "hub_negocios"
        ? Promise.resolve({ data: negocio, error: null })
        : Promise.resolve({ data: null, error: null }); // idempotência: entrega ainda não existe
    b.single = () =>
      Promise.resolve({
        data: {
          id: "ent-1",
          codigo: "COD-2026-0001",
          titulo: negocio.titulo,
          status: "novo",
          negocio_id: negocio.id,
        },
        error: null,
      });
    // torna o builder "awaitable" p/ inserts diretos (hub_atividades, log, evento)
    b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(terminal).then(resolve, reject);
    return b;
  };

  const client = { from, rpc: () => Promise.resolve({ data: "COD-2026-0001", error: null }) };
  return { client: client as unknown as SupabaseClient, atividadeInserts };
}

function negocioGanho(prefixo: string | null): Record<string, unknown> {
  return {
    id: "neg-1",
    codigo: "NEG-1",
    titulo: "Reforma Consulado",
    prefixo_mercado: prefixo,
    status: "fechado_ganho",
    etapa: "ganho",
    lead_id: "lead-1",
    tenant_id: "t-1",
  };
}

const MERCADOS: { nome: string; prefixo: string | null; tipo: TipoDerivado }[] = [
  { nome: "sem-mercado→Obra", prefixo: null, tipo: ENTREGA_OBRA.tipo },
  { nome: "ARQ→Projeto", prefixo: "ARQ", tipo: ENTREGA_POR_MERCADO.ARQ.tipo },
  { nome: "MRC→Marcenaria", prefixo: "MRC", tipo: ENTREGA_POR_MERCADO.MRC.tipo },
  { nome: "MMR→Marmoraria", prefixo: "MMR", tipo: ENTREGA_POR_MERCADO.MMR.tipo },
  { nome: "VDR→Vidraçaria", prefixo: "VDR", tipo: ENTREGA_POR_MERCADO.VDR.tipo },
  { nome: "SRV→Serviço", prefixo: "SRV", tipo: ENTREGA_POR_MERCADO.SRV.tipo },
];

describe("derivarEntregaDoNegocio — CHECK de hub_atividades (EST-03)", () => {
  it.each(MERCADOS)(
    "grava atividade dentro do CHECK e deriva a entrega certa — $nome",
    async ({ prefixo, tipo }) => {
      const { client, atividadeInserts } = mockSupabase(negocioGanho(prefixo));
      const res = await derivarEntregaDoNegocio(client, "neg-1", { origem: "automatica" });

      expect(res.ok).toBe(true);
      if (res.ok) expect(res.tipo).toBe(tipo);

      expect(atividadeInserts).toHaveLength(1);
      const ativ = atividadeInserts[0];
      expect(TIPO_SEGURO.has(String(ativ.tipo))).toBe(true);
      expect(FEITO_POR_TIPO_SEGURO.has(String(ativ.feito_por_tipo))).toBe(true);
    }
  );

  it("origem manual usa feito_por_tipo='humano' (dentro do CHECK)", async () => {
    const { client, atividadeInserts } = mockSupabase(negocioGanho("ARQ"));
    await derivarEntregaDoNegocio(client, "neg-1", { origem: "manual" });
    expect(atividadeInserts[0].feito_por_tipo).toBe("humano");
    expect(atividadeInserts[0].feito_por).toBe("humano");
  });

  it("CHECK rejeitando a atividade NÃO quebra a esteira — loga, entrega segue", async () => {
    const { client } = mockSupabase(negocioGanho("ARQ"), {
      atividadeError: { message: "new row violates check constraint" },
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await derivarEntregaDoNegocio(client, "neg-1", { origem: "manual" });

    expect(res.ok).toBe(true); // a entrega já foi criada — atividade é best-effort
    expect(spy).toHaveBeenCalled(); // mas NÃO engole: o erro é logado (alarme)
    spy.mockRestore();
  });
});
