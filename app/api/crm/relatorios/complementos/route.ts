import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { tenantScopeOrFilter } from "@/lib/tenant-default";

/**
 * Counts laterais da tela de Relatórios (decisões pendentes + KPIs fora da meta).
 * Antes eram consultados no client com a anon key SEM filtro de tenant (dependiam só
 * de RLS, que tem drift conhecido). Agora correm no server com o tenant da sessão e
 * filtro explícito — defesa em profundidade, sem cruzar dados entre tenants.
 */
export async function GET(request: NextRequest) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const tenantId = g.ctx.tenantId;
  const db = crmDb();
  const desde24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [aprov, kpis] = await Promise.all([
    db
      .from("hub_aprovacoes")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendente")
      .or(tenantScopeOrFilter(tenantId)),
    db
      .from("hub_kpis_resultados")
      .select("id", { count: "exact", head: true })
      .neq("nivel_alerta", "ok")
      .gte("criado_em", desde24h)
      .or(tenantScopeOrFilter(tenantId)),
  ]);

  return NextResponse.json({
    decisoesPendentes: aprov.count ?? 0,
    kpisForaMeta: kpis.count ?? 0,
  });
}
