import { crmDb as db } from "@/lib/crm/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import {
  contarMemoriasAgente,
  limparMemoriasAgente,
} from "@/lib/hub/limpar-memorias-agente";
import { requireCrmGestor, requireCrmSessao } from "@/lib/crm/crm-api-auth";

/**
 * Retorna 404 se o agente pertence a outro tenant.
 * Service-role bypassa RLS — esta checagem explícita é a única proteção.
 */
function agenteForaDoTenant(
  row: { tenant_id?: string | null } | null | undefined,
  tenantId: string
): boolean {
  if (!row) return false;
  return row.tenant_id != null && String(row.tenant_id) !== tenantId;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  // E-B1 (GET): guard de sessão — qualquer papel CRM ativo pode ver a contagem.
  const g = await requireCrmSessao(req);
  if ("error" in g) return g.error;

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw).trim();
  if (!slug) {
    return NextResponse.json({ error: "Slug inválido." }, { status: 400 });
  }

  const supabase = db();
  const { data: agente } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug, tenant_id")
    .eq("agente_slug", slug)
    .maybeSingle();

  if (!agente || agenteForaDoTenant(agente as { tenant_id?: string | null }, g.ctx.tenantId)) {
    return NextResponse.json({ error: "Agente não encontrado." }, { status: 404 });
  }

  const contagem = await contarMemoriasAgente(supabase, slug);
  return NextResponse.json(contagem);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  // E-B1 (DELETE): apaga memórias + zera leads — exige gestor ou owner.
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw).trim();
  if (!slug) {
    return NextResponse.json({ error: "Slug inválido." }, { status: 400 });
  }

  let incluirBriefing = true;
  try {
    const body = await request.json();
    if (body && typeof body === "object" && body.incluir_briefing === false) {
      incluirBriefing = false;
    }
  } catch {
    /* body opcional */
  }

  const supabase = db();
  const { data: agente } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug, tenant_id")
    .eq("agente_slug", slug)
    .maybeSingle();

  // Isolamento de tenant: 404 se o agente pertence a outro tenant (não vaza existência).
  if (!agente || agenteForaDoTenant(agente as { tenant_id?: string | null }, g.ctx.tenantId)) {
    return NextResponse.json({ error: "Agente não encontrado." }, { status: 404 });
  }

  try {
    const resultado = await limparMemoriasAgente(supabase, slug, { incluirBriefing });
    return NextResponse.json({
      ok: true,
      agente_slug: slug,
      ...resultado,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao limpar memórias.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
