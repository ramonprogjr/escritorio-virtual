import { crmDb } from "@/lib/crm/supabase-server";
import { custoUsdDeTokens, custoBrl, creditosDeCusto } from "./metering-calc";

/* eslint-disable @typescript-eslint/no-explicit-any */
type SupabaseLike = { from: (t: string) => any };

export type ConfigPreco = { markup: number; fxUsdBrl: number; valorCreditoBrl: number };
export const CONFIG_PADRAO: ConfigPreco = { markup: 10, fxUsdBrl: 6, valorCreditoBrl: 0.1 };

export type ConsumoInput = {
  tenantId: string;
  usuarioId?: string | null;
  origem: string;
  modelo: string;
  tokensEntrada: number;
  tokensSaida: number;
  refTipo?: string | null;
  refId?: string | null;
};

export async function carregarConfigPreco(
  tenantId: string,
  db: SupabaseLike = crmDb(),
): Promise<ConfigPreco> {
  try {
    const { data } = await db
      .from("hub_ia_config")
      .select("escopo, tenant_id, markup, fx_usd_brl, valor_credito_brl")
      .or(`and(escopo.eq.tenant,tenant_id.eq.${tenantId}),escopo.eq.global`);
    const rows: any[] = Array.isArray(data) ? data : [];
    const cfg = rows.find((r) => r.escopo === "tenant") ?? rows.find((r) => r.escopo === "global");
    if (!cfg) return CONFIG_PADRAO;
    return {
      markup: Number(cfg.markup ?? CONFIG_PADRAO.markup),
      fxUsdBrl: Number(cfg.fx_usd_brl ?? CONFIG_PADRAO.fxUsdBrl),
      valorCreditoBrl: Number(cfg.valor_credito_brl ?? CONFIG_PADRAO.valorCreditoBrl),
    };
  } catch {
    return CONFIG_PADRAO;
  }
}

/** Best-effort: registra o consumo e o débito; nunca lança (não quebra o fluxo de IA). */
export async function registrarConsumoIA(
  p: ConsumoInput,
  db: SupabaseLike = crmDb(),
): Promise<{ creditos: number; custoBrl: number } | null> {
  try {
    const cfg = await carregarConfigPreco(p.tenantId, db);
    const usd = custoUsdDeTokens({
      modelo: p.modelo,
      tokensEntrada: p.tokensEntrada,
      tokensSaida: p.tokensSaida,
    });
    const brl = custoBrl(usd, cfg.fxUsdBrl, cfg.markup);
    const creditos = creditosDeCusto(brl, cfg.valorCreditoBrl);

    await db.from("hub_ia_consumo").insert({
      tenant_id: p.tenantId,
      usuario_id: p.usuarioId ?? null,
      origem: p.origem,
      modelo: p.modelo,
      tokens_entrada: p.tokensEntrada,
      tokens_saida: p.tokensSaida,
      custo_usd: usd,
      custo_brl: brl,
      creditos,
      ref_tipo: p.refTipo ?? null,
      ref_id: p.refId ?? null,
    });
    await db.from("hub_ia_creditos_mov").insert({
      tenant_id: p.tenantId,
      tipo: "debito",
      creditos: -creditos,
      descricao: `IA ${p.origem} (${p.modelo})`,
      ref_id: p.refId ?? null,
    });
    return { creditos, custoBrl: brl };
  } catch {
    return null;
  }
}

/** Saldo (Tijolos) = soma de todos os movimentos da carteira do tenant. */
export async function saldoCreditos(tenantId: string, db: SupabaseLike = crmDb()): Promise<number> {
  try {
    const { data } = await db
      .from("hub_ia_creditos_mov")
      .select("creditos")
      .eq("tenant_id", tenantId);
    const rows: any[] = Array.isArray(data) ? data : [];
    return rows.reduce((s, r) => s + Number(r.creditos ?? 0), 0);
  } catch {
    return 0;
  }
}
