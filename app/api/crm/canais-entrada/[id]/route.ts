import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmGestor } from "@/lib/crm/crm-api-auth";

type Params = { params: Promise<{ id: string }> };

const SELECT = "id, tipo, nome, identificador, origem_slug, ativo, observacao, criado_em";
const EDITAVEIS = ["tipo", "nome", "identificador", "origem_slug", "ativo", "observacao"] as const;

/** Pré-checa que o canal pertence ao tenant do chamador (null-safe p/ legado). 404 se divergir. */
async function tenantGuard(id: string, tenantId: string) {
  const { data } = await crmDb()
    .from("hub_canais_entrada")
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
  // Isolamento de tenant (espelha contatos/[id]): service-role bypassa RLS, este é o guard.
  const guard = await tenantGuard(id, g.ctx.tenantId);
  if ("notFound" in guard) return NextResponse.json({ error: "Canal não encontrado." }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const patch: Record<string, unknown> = {};
  for (const k of EDITAVEIS) {
    if (k in body) {
      if (k === "ativo") patch.ativo = body.ativo === true;
      else patch[k] = body[k] ? String(body[k]).trim() : null;
    }
  }
  if (typeof body.nome === "string" && !body.nome.trim()) {
    return NextResponse.json({ error: "Nome não pode ficar vazio" }, { status: 400 });
  }

  const { data, error } = await crmDb()
    .from("hub_canais_entrada")
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
  // Isolamento de tenant (espelha contatos/[id]): não deixar apagar canal de outro tenant.
  const guard = await tenantGuard(id, g.ctx.tenantId);
  if ("notFound" in guard) return NextResponse.json({ error: "Canal não encontrado." }, { status: 404 });

  // Princípio "só arquiva": nunca hard-delete — desativa (ativo=false) e o canal permanece
  // no banco. A listagem (GET) esconde ativo=false, então o canal some da tela.
  const { error } = await crmDb().from("hub_canais_entrada").update({ ativo: false }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
