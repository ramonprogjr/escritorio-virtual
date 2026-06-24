import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";

type Params = { params: Promise<{ id: string }> };

const SELECT =
  "id, prioridade, ativo, origem, mercado, uf, destino_tipo, destino_valor, rotulo, criado_em";

const EDITAVEIS = ["prioridade", "ativo", "origem", "mercado", "uf", "destino_tipo", "destino_valor", "rotulo"] as const;

export async function PATCH(request: NextRequest, { params }: Params) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
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

export async function DELETE(_request: NextRequest, { params }: Params) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  const { error } = await crmDb().from("hub_lead_routing_regras").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
