import { crmDb as db } from "@/lib/crm/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { syncHubAgenteParaMistral } from "@/lib/mistral/sync-hub-agent";
import { requireCrmGestor } from "@/lib/crm/crm-api-auth";

/** Retorna true se a linha pertence a outro tenant (service-role bypassa RLS). */
function agenteForaDoTenant(
  row: { tenant_id?: string | null } | null | undefined,
  tenantId: string
): boolean {
  if (!row) return false;
  return row.tenant_id != null && String(row.tenant_id) !== tenantId;
}

/**
 * Reenvia o estado do agente Hub para a Mistral Agents API (útil após erros ou mudanças manuais).
 * E-B5: exige gestor — sincronização dispara chamada externa com custo.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  // E-B5: guard de gestor + isolamento de tenant antes de chamar Mistral (custo externo).
  const g = await requireCrmGestor(req);
  if ("error" in g) return g.error;

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const supabase = db();

  const { data: row } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug, mistral_agent_sync_habilitado, tenant_id")
    .eq("agente_slug", slug)
    .maybeSingle();

  if (!row || agenteForaDoTenant(row as { tenant_id?: string | null }, g.ctx.tenantId)) {
    return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 });
  }

  if (row.mistral_agent_sync_habilitado !== true) {
    return NextResponse.json(
      {
        error:
          "Ative «Provisionar agente na Mistral» na ficha do agente antes de sincronizar.",
      },
      { status: 409 }
    );
  }

  const out = await syncHubAgenteParaMistral(supabase, slug);
  if (!out.ok) {
    return NextResponse.json({ error: out.error }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    mistral_agent_id: out.mistral_agent_id,
    created: out.created,
  });
}
