import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmComercial } from "@/lib/crm/crm-api-auth";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  // Isolamento de tenant: sob service-role a RLS é bypassada. Pré-cheque por id → 404 se o
  // pedido for de outro tenant (legado sem tenant_id = partilhado, mesmo critério das irmãs).
  const { data: existente } = await crmDb()
    .from("hub_pedidos_material")
    .select("tenant_id")
    .eq("id", id)
    .maybeSingle();
  if (!existente) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  const tid = (existente as { tenant_id: string | null }).tenant_id;
  if (tid && tid !== g.ctx.tenantId) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const updates: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  if (body.descricao != null) updates.descricao = String(body.descricao).trim();
  if (body.status != null) updates.status = body.status;
  if (body.valor_estimado != null) updates.valor_estimado = Number(body.valor_estimado);
  if ("obra_id" in body) updates.obra_id = body.obra_id || null;

  const { data, error } = await crmDb()
    .from("hub_pedidos_material")
    .update(updates)
    .eq("id", id)
    .select("id, codigo, obra_id, descricao, status, valor_estimado")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  return NextResponse.json({ data });
}
