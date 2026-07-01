import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireCrmComercial } from "@/lib/crm/crm-api-auth";
import { DEFAULT_OBRA10_TENANT_ID, isMissingPgColumn } from "@/lib/tenant-default";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Confina o acesso ao tenant do caller. Busca o imóvel por id (service-role bypassa RLS)
 * e devolve 404 se ele pertencer a outro escritório. NULL/Obra10 padrão = legado partilhado
 * (mesmo critério de app/api/crm/pessoas/[id]/route.ts).
 */
async function carregarImovelDoTenant(
  supabase: ReturnType<typeof db>,
  id: string,
  tenantId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data, error } = await supabase
    .from("hub_imoveis")
    .select("id, tenant_id")
    .eq("id", id)
    .maybeSingle();
  if (error && !isMissingPgColumn(error, "tenant_id")) {
    return { ok: false, status: 500, error: error.message };
  }
  if (!data) {
    return { ok: false, status: 404, error: "Imóvel não encontrado" };
  }
  const row = data as { tenant_id?: string | null };
  const tid = row.tenant_id != null ? String(row.tenant_id).trim() : "";
  if (tid && tid !== tenantId && tid !== DEFAULT_OBRA10_TENANT_ID) {
    return { ok: false, status: 404, error: "Imóvel não encontrado" };
  }
  return { ok: true };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const supabase = db();

  // Guard de tenant: 404 se o registo for de outro escritório (service-role bypassa RLS).
  const posse = await carregarImovelDoTenant(supabase, id, g.ctx.tenantId);
  if (!posse.ok) {
    return NextResponse.json({ error: posse.error }, { status: posse.status });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const updates: Record<string, unknown> = { atualizado_em: new Date().toISOString() };

  if (body.titulo != null) updates.titulo = String(body.titulo).trim();
  if (body.tipo != null) updates.tipo = body.tipo;
  if (body.finalidade != null) updates.finalidade = body.finalidade;
  if (body.status != null) updates.status = body.status;
  if (body.cidade != null) updates.cidade = body.cidade;
  if (body.estado != null) updates.estado = body.estado;
  if (body.bairro != null) updates.bairro = body.bairro;
  if (body.valor != null) updates.valor = Number(body.valor);
  if (typeof body.ativo === "boolean") updates.ativo = body.ativo;
  if (body.dormitorios != null) updates.dormitorios = Number(body.dormitorios);
  if (body.area_total_m2 != null) updates.area_total_m2 = Number(body.area_total_m2);

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("hub_imoveis")
    .update(updates)
    .eq("id", id)
    .select("id, codigo, titulo, tipo, finalidade, status, valor, cidade, estado, ativo")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Imóvel não encontrado" }, { status: 404 });
  return NextResponse.json({ data });
}
