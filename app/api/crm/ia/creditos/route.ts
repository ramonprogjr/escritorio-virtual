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
 */
export async function GET(request: NextRequest) {
  const config = crmApiConfigError();
  if (config) return config;

  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  const db = crmDb();
  const tenantId = g.ctx.tenantId;

  const saldo = await saldoCreditos(tenantId, db);

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
