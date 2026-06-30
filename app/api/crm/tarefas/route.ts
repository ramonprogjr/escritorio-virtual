import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { getCallerContext } from "@/lib/crm/crm-api-auth";

/** Lista tarefas comerciais — tabela opcional (graceful se ausente). */
export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  // F-A8: escopo obrigatório por tenant (padrão tenant_id NULL leak — memória sistêmica).
  // crmDb() usa service_role e bypassa RLS; sem .eq("tenant_id") vaza tarefas entre tenants.
  const g = await getCallerContext(request);
  if ("error" in g) return g.error;
  const tenantId = g.ctx.tenantId;

  const supabase = crmDb();
  const { data, error } = await supabase
    .from("hub_tarefas_comerciais")
    .select("id, titulo, descricao, status, prioridade, vencimento_em, lead_id, negocio_id")
    .eq("tenant_id", tenantId)
    .order("vencimento_em", { ascending: true, nullsFirst: false })
    .limit(50);

  if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
    return NextResponse.json({ data: [] });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: data ?? [] });
}
