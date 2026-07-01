import { crmDb } from "@/lib/crm/supabase-server";
import {
  custoUsdDeTokens,
  custoBrl,
  creditosDeCusto,
  type PrecoModelo,
} from "./metering-calc";

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

/**
 * Carrega a TABELA DE PREÇOS editável no painel (`hub_ia_precos`) e a converte para o
 * shape consumido por `custoUsdDeTokens`. Só inclui modelos `ativo`. Tolerante por design:
 * se a tabela estiver vazia, der erro ou a coluna não existir, retorna `undefined` e o
 * cálculo recai em `PRECOS_MODELOS` (comportamento atual). Modo sombra — sem cobrança real.
 */
export async function carregarTabelaPrecos(
  db: SupabaseLike = crmDb(),
): Promise<Record<string, PrecoModelo> | undefined> {
  try {
    const { data, error } = await db
      .from("hub_ia_precos")
      .select("modelo, input_usd_milhao, output_usd_milhao, ativo");
    if (error) return undefined;
    const rows: any[] = Array.isArray(data) ? data : [];
    const tabela: Record<string, PrecoModelo> = {};
    for (const r of rows) {
      const modelo = String(r?.modelo ?? "").trim();
      if (!modelo) continue;
      if (r?.ativo === false) continue; // modelo desativado no painel → ignora (cai no default)
      const input = Number(r?.input_usd_milhao);
      const output = Number(r?.output_usd_milhao);
      if (!Number.isFinite(input) || !Number.isFinite(output)) continue;
      tabela[modelo] = { inputUsdMilhao: input, outputUsdMilhao: output };
    }
    // Tabela vazia (nenhum preço válido) → undefined para usar os preços de referência.
    return Object.keys(tabela).length > 0 ? tabela : undefined;
  } catch {
    return undefined;
  }
}

/** Best-effort: registra o consumo e o débito; nunca lança (não quebra o fluxo de IA). */
export async function registrarConsumoIA(
  p: ConsumoInput,
  db: SupabaseLike = crmDb(),
): Promise<{ creditos: number; custoBrl: number } | null> {
  try {
    const cfg = await carregarConfigPreco(p.tenantId, db);
    // Preços do PAINEL (hub_ia_precos) têm prioridade; ausentes/erro → PRECOS_MODELOS.
    const tabela = await carregarTabelaPrecos(db);
    const usd = custoUsdDeTokens({
      modelo: p.modelo,
      tokensEntrada: p.tokensEntrada,
      tokensSaida: p.tokensSaida,
      tabela,
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

export type ResultadoGateSaldo = {
  /** Se a chamada ao LLM pode prosseguir. Em modo sombra é SEMPRE true (fail-open). */
  permitido: boolean;
  saldo: number;
  modo: "sombra" | "bloqueio";
};

/**
 * Gate ATÔMICO de saldo, a ser checado ANTES de gastar tokens no LLM (chokepoint).
 *
 * Modo é decidido pela env `IA_HARD_CAP`:
 *  - Ausente/diferente de "on" → **modo sombra** (default absoluto): `permitido=true` SEMPRE;
 *    só loga um aviso estruturado quando o saldo já estaria negativo. Não bloqueia ninguém.
 *  - `"on"` → **modo bloqueio**: `permitido=false` quando o saldo é insuficiente (< 0).
 *
 * Fail-safe: qualquer erro ao consultar o saldo (rede, tabela ausente, etc.) devolve
 * `permitido=true` — nunca travar o atendimento por falha de LEITURA da carteira.
 * `saldoCreditos` já é, por si, tolerante a erro (retorna 0), então o catch aqui cobre
 * apenas falhas inesperadas fora dela.
 */
export async function assertSaldoAntesDoLLM(
  tenantId: string,
  _estimativaTokens?: number,
  db: SupabaseLike = crmDb(),
): Promise<ResultadoGateSaldo> {
  const hardCapLigado = (process.env.IA_HARD_CAP ?? "").trim().toLowerCase() === "on";
  const modo: "sombra" | "bloqueio" = hardCapLigado ? "bloqueio" : "sombra";

  let saldo: number;
  try {
    saldo = await saldoCreditos(tenantId, db);
  } catch (e) {
    console.warn("[METERING] assertSaldoAntesDoLLM: erro ao consultar saldo — fail-open", e);
    return { permitido: true, saldo: 0, modo };
  }

  const saldoInsuficiente = saldo < 0;

  if (!hardCapLigado) {
    if (saldoInsuficiente) {
      console.warn(
        `[METERING] tenant ${tenantId} com saldo negativo (${saldo} Tijolos) — modo sombra, NÃO bloqueando (IA_HARD_CAP != "on")`,
      );
    }
    return { permitido: true, saldo, modo };
  }

  if (saldoInsuficiente) {
    console.warn(`[METERING] tenant ${tenantId} bloqueado por saldo insuficiente (${saldo} Tijolos) — IA_HARD_CAP=on`);
    return { permitido: false, saldo, modo };
  }

  return { permitido: true, saldo, modo };
}
