import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";

type Params = { params: Promise<{ id: string }> };

const SELECT = "id, tipo, nome, identificador, origem_slug, ativo, observacao, criado_em";
const EDITAVEIS = ["tipo", "nome", "identificador", "origem_slug", "ativo", "observacao"] as const;

export async function PATCH(request: NextRequest, { params }: Params) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
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

export async function DELETE(_request: NextRequest, { params }: Params) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  const { error } = await crmDb().from("hub_canais_entrada").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
