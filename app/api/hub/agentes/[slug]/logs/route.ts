import { crmDb as db } from "@/lib/crm/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";

/** Retorna true se a linha pertence a outro tenant (service-role bypassa RLS). */
function agenteForaDoTenant(
  row: { tenant_id?: string | null } | null | undefined,
  tenantId: string
): boolean {
  if (!row) return false;
  return row.tenant_id != null && String(row.tenant_id) !== tenantId;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  // E-B3: guard de sessão + isolamento de tenant. hub_prompt_logs expõe prompts/respostas de IA.
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);

  const { searchParams } = new URL(request.url);
  const requested = Number(searchParams.get("limit") || 60);
  const limit = Number.isFinite(requested)
    ? Math.max(1, Math.min(200, Math.floor(requested)))
    : 60;

  const supabase = db();

  // Verificar que o agente pertence ao tenant da sessão antes de expor logs.
  const { data: agenteRow } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug, tenant_id")
    .eq("agente_slug", slug)
    .maybeSingle();

  if (!agenteRow || agenteForaDoTenant(agenteRow as { tenant_id?: string | null }, g.ctx.tenantId)) {
    return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("hub_prompt_logs")
    .select("*")
    .eq("agente_slug", slug)
    .order("criado_em", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ logs: data || [] });
}
