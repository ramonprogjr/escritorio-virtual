import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmGestor } from "@/lib/crm/crm-api-auth";

type Params = { params: Promise<{ id: string }> };

/**
 * Confirma que o pipeline pertence ao tenant do caller (null-safe p/ legado).
 * Retorna NextResponse de erro (404) se não pertence; null se OK.
 * RLS está bypassada (service-role) — checagem explícita é a única proteção.
 */
async function assertPipelineDoTenant(
  pipelineId: string,
  tenantId: string
): Promise<NextResponse | null> {
  const { data } = await crmDb()
    .from("hub_pipelines")
    .select("id, tenant_id")
    .eq("id", pipelineId)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "Pipeline não encontrado" }, { status: 404 });
  if (data.tenant_id && data.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Pipeline não encontrado" }, { status: 404 });
  }
  return null;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id: pipelineId } = await params;

  const tenantErr = await assertPipelineDoTenant(pipelineId, g.ctx.tenantId);
  if (tenantErr) return tenantErr;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ error: "slug é obrigatório" }, { status: 400 });

  const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  if (typeof body.ativo === "boolean") patch.ativo = body.ativo;
  if (body.label != null) patch.label = String(body.label).trim();
  if (body.cor != null) patch.cor = String(body.cor).trim();
  if (body.ordem != null) patch.ordem = Number(body.ordem);

  const supabase = crmDb();
  const { data, error } = await supabase
    .from("hub_pipeline_estagios")
    .update(patch)
    .eq("pipeline_id", pipelineId)
    .eq("slug", slug)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Estágio não encontrado" }, { status: 404 });

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest, { params }: Params) {
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id: pipelineId } = await params;

  const tenantErr = await assertPipelineDoTenant(pipelineId, g.ctx.tenantId);
  if (tenantErr) return tenantErr;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const slug = String(body.slug || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_");
  const label = String(body.label || slug).trim();
  if (!slug || slug.length < 2) {
    return NextResponse.json({ error: "slug inválido" }, { status: 400 });
  }

  const supabase = crmDb();
  const { count } = await supabase
    .from("hub_pipeline_estagios")
    .select("*", { count: "exact", head: true })
    .eq("pipeline_id", pipelineId);

  const { data, error } = await supabase
    .from("hub_pipeline_estagios")
    .insert({
      pipeline_id: pipelineId,
      slug,
      label,
      cor: String(body.cor || "#6B7280"),
      ordem: Number(body.ordem ?? count ?? 0),
      tipo_fecho: String(body.tipo_fecho || "aberto"),
      sistema: false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
