import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { requireCrmGestor } from "@/lib/crm/crm-api-auth";
import { registrarEvento } from "@/lib/crm/registrar-evento";

/**
 * Cobrança do Hub (C.1b) — o gestor/IA dispara uma cobrança a um fornecedor por
 * pendência/KPI/SLA. Emite evento `fornecedor_cobrado` que aparece no feed da rede e
 * no sino de notificações (notificações derivam do hub_eventos).
 */
export async function POST(request: NextRequest) {
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  const body = (await request.json().catch(() => ({}))) as { fornecedor_id?: string; motivo?: string };
  const fornecedorId = typeof body.fornecedor_id === "string" ? body.fornecedor_id.trim() : "";
  if (!fornecedorId) return NextResponse.json({ error: "fornecedor_id obrigatório" }, { status: 400 });

  const supabase = crmDb();
  const { data: parc } = await supabase
    .from("hub_parceiros")
    .select("id, nome, tenant_id")
    .eq("id", fornecedorId)
    .maybeSingle();
  if (!parc) return NextResponse.json({ error: "Fornecedor não encontrado" }, { status: 404 });
  if (parc.tenant_id && parc.tenant_id !== g.ctx.tenantId) {
    return NextResponse.json({ error: "Fornecedor não encontrado" }, { status: 404 });
  }

  await registrarEvento(supabase, {
    event_type: "fornecedor_cobrado",
    entity_type: "fornecedor",
    entity_id: fornecedorId,
    fornecedor_id: fornecedorId,
    ator: "humano",
    payload: { parceiro_nome: parc.nome, motivo: body.motivo?.trim() || "Pendência / KPI / SLA" },
    tenant_id: (parc.tenant_id as string) ?? g.ctx.tenantId,
  });

  return NextResponse.json({ ok: true });
}
