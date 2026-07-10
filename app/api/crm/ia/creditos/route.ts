import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { crmApiConfigError, requireCrmGestor } from "@/lib/crm/crm-api-auth";
import { saldoCreditos } from "@/lib/ia/metering";

export type ConsumoRow = {
  origem: string;
  modelo: string;
  creditos: number;
  // custo_brl removido — margem interna, não exposta ao browser (E-A1).
  criado_em: string;
};

/**
 * GET /api/crm/ia/creditos — saldo (Tijolos) + extrato de consumo do escritório.
 * Tenant-scoped + guard de gestor. Fase 1: leitura/observabilidade (sem bloqueio).
 *
 * `?origem=` (opcional): devolve também a MÉDIA REAL de Tijolos daquela ação neste escritório —
 * é o que alimenta o aviso "antes de executar uma ação que consome muito". Sem histórico devolve
 * media=null (a UI diz honestamente que ainda não sabe). Token e R$ nunca viajam ao browser (E-A1).
 */
export async function GET(request: NextRequest) {
  const config = crmApiConfigError();
  if (config) return config;

  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  const db = crmDb();
  const tenantId = g.ctx.tenantId;

  const saldo = await saldoCreditos(tenantId, db);

  // Modo "estimativa de uma ação": só o que o aviso precisa (saldo + média + nº de amostras).
  const origemAlvo = (new URL(request.url).searchParams.get("origem") || "").trim();
  if (origemAlvo) {
    const { data: amostrasData } = await db
      .from("hub_ia_consumo")
      .select("creditos")
      .eq("tenant_id", tenantId)
      .eq("origem", origemAlvo)
      .limit(200);
    const valores = ((amostrasData ?? []) as Array<{ creditos: number | null }>)
      .map((r) => Math.abs(Number(r.creditos ?? 0)))
      .filter((n) => Number.isFinite(n) && n > 0);
    const media = valores.length ? valores.reduce((s, n) => s + n, 0) / valores.length : null;
    return NextResponse.json({ saldo, origem: origemAlvo, media, amostras: valores.length });
  }

  // E-A1: custo_brl é margem interna — nunca viaja ao browser.
  const { data, error } = await db
    .from("hub_ia_consumo")
    .select("origem, modelo, creditos, criado_em")
    .eq("tenant_id", tenantId)
    .order("criado_em", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ saldo, consumo: (data ?? []) as ConsumoRow[] });
}
