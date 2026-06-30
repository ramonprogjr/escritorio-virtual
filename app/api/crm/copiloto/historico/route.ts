import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { crmApiConfigError, requireCrmSessao } from "@/lib/crm/crm-api-auth";

/**
 * GET /api/crm/copiloto/historico
 *
 * Retorna o histórico de consumo IA do copiloto para o tenant da sessão.
 * E-A3: substitui a leitura direta do client Supabase (anon key + RLS) por rota
 * server-side com guard de sessão + escopo de tenant explícito.
 *
 * Nota: custo_brl é excluído do select (margem interna — ver E-A1).
 */
export async function GET(request: NextRequest) {
  const config = crmApiConfigError();
  if (config) return config;

  // E-A3: guard de sessão — qualquer papel CRM ativo pode ver o próprio histórico.
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const db = crmDb();
  const tenantId = g.ctx.tenantId;

  const { data, error } = await db
    .from("hub_ia_consumo")
    .select("origem, modelo, creditos, ref_id, criado_em")
    .eq("tenant_id", tenantId)
    .like("origem", "copiloto_%")
    .order("criado_em", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rows: data ?? [] });
}
