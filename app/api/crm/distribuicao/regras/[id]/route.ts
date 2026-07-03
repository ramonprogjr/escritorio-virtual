import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmGestor } from "@/lib/crm/crm-api-auth";

type Params = { params: Promise<{ id: string }> };

const SELECT =
  "id, prioridade, ativo, origem, mercado, uf, destino_tipo, destino_valor, rotulo, criado_em";

const EDITAVEIS = ["prioridade", "ativo", "origem", "mercado", "uf", "destino_tipo", "destino_valor", "rotulo"] as const;

/** Pré-checa que a regra pertence ao tenant do chamador (null-safe p/ legado). 404 se divergir. */
async function tenantGuard(id: string, tenantId: string) {
  const { data } = await crmDb()
    .from("hub_lead_routing_regras")
    .select("tenant_id")
    .eq("id", id)
    .maybeSingle();
  if (!data) return { notFound: true as const };
  const tid = (data as { tenant_id: string | null }).tenant_id;
  if (tid && tid !== tenantId) return { notFound: true as const };
  return { ok: true as const };
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  // Isolamento de tenant: service-role bypassa RLS, este pré-cheque impede editar regra de
  // roteamento de outro tenant (podia sequestrar leads para um destino alheio).
  const guard = await tenantGuard(id, g.ctx.tenantId);
  if ("notFound" in guard) return NextResponse.json({ error: "Regra não encontrada." }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const patch: Record<string, unknown> = {};
  for (const k of EDITAVEIS) {
    if (k in body) {
      if (k === "ativo") patch.ativo = body.ativo === true;
      else if (k === "prioridade") patch.prioridade = Number(body.prioridade) || 100;
      else if (k === "mercado" || k === "uf") patch[k] = body[k] ? String(body[k]).toUpperCase() : null;
      else patch[k] = body[k] ? String(body[k]).trim() : null;
    }
  }

  const { data, error } = await crmDb()
    .from("hub_lead_routing_regras")
    .update(patch)
    .eq("id", id)
    .select(SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  // Isolamento de tenant: não deixar apagar regra de roteamento de outro tenant.
  const guard = await tenantGuard(id, g.ctx.tenantId);
  if ("notFound" in guard) return NextResponse.json({ error: "Regra não encontrada." }, { status: 404 });

  // Princípio "só arquiva": nunca hard-delete — desativa (ativo=false) e a regra permanece
  // no banco. A listagem (GET) esconde ativo=false, então a regra some da tela.
  const { error } = await crmDb().from("hub_lead_routing_regras").update({ ativo: false }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
