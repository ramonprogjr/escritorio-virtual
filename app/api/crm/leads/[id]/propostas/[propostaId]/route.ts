import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";

type Params = { params: Promise<{ id: string; propostaId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  // Guard (middleware é morto → cada rota se protege). Estava SEM guard nem filtro de
  // tenant — o "irmão" (.../propostas/route.ts, coleção) já tinha sido corrigido no
  // H-SEC-1; este endpoint de item individual (PATCH/DELETE por id) ficou aberto.
  const sessao = await requireCrmSessao(request);
  if ("error" in sessao) return sessao.error;

  const { id: lead_id, propostaId } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const allowed = ["titulo", "valor", "escopo", "prazo_dias", "status", "motivo_recusa"] as const;
  const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  const supabase = crmDb();

  // Guard de posse: a proposta precisa pertencer ao tenant do caller.
  const { data: existente, error: fetchErr } = await supabase
    .from("hub_propostas")
    .select("id, tenant_id")
    .eq("id", propostaId)
    .eq("lead_id", lead_id)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!existente) return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });
  const tid = existente.tenant_id != null ? String(existente.tenant_id).trim() : "";
  if (tid && tid !== sessao.ctx.tenantId) {
    return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("hub_propostas")
    .update(patch)
    .eq("id", propostaId)
    .eq("lead_id", lead_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  // Guard (middleware é morto → cada rota se protege). Mesma lacuna do PATCH acima.
  const sessao = await requireCrmSessao(request);
  if ("error" in sessao) return sessao.error;

  const { id: lead_id, propostaId } = await params;
  const supabase = crmDb();

  const { data: existente, error: fetchErr } = await supabase
    .from("hub_propostas")
    .select("id, tenant_id")
    .eq("id", propostaId)
    .eq("lead_id", lead_id)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!existente) return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });
  const tid = existente.tenant_id != null ? String(existente.tenant_id).trim() : "";
  if (tid && tid !== sessao.ctx.tenantId) {
    return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });
  }

  const { error } = await supabase.from("hub_propostas").delete().eq("id", propostaId).eq("lead_id", lead_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
