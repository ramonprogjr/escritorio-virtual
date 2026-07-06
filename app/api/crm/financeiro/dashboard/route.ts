import { NextRequest, NextResponse } from "next/server";
import { aggregateFinanceDashboard } from "@/lib/crm/finance-dashboard-aggregate";
import { requireCrmFinanceiro } from "@/lib/crm/crm-api-auth";
import { crmDb as db } from "@/lib/crm/supabase-server";

export async function GET(request: NextRequest) {
  const auth = await requireCrmFinanceiro(request);
  if ("error" in auth) return auth.error;

  const tenantId = auth.ctx.tenantId;
  try {
    const payload = await aggregateFinanceDashboard(db(), tenantId);
    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao agregar painel financeiro";
    console.error("[api/crm/financeiro/dashboard]", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
