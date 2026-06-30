import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { tenantScopeOrFilter } from "@/lib/tenant-default";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  // H-SEC-1: estava SEM guard nem filtro de tenant (qualquer lead_id vazava propostas).
  const sessao = await requireCrmSessao(request);
  if ("error" in sessao) return sessao.error;

  const { id } = await params;
  const { data, error } = await crmDb()
    .from("hub_propostas")
    .select("*")
    .eq("lead_id", id)
    .or(tenantScopeOrFilter(sessao.ctx.tenantId))
    .order("criado_em", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest, { params }: Params) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  // H-SEC-1: estava SEM guard (qualquer um criava proposta em qualquer lead).
  const sessao = await requireCrmSessao(request);
  if ("error" in sessao) return sessao.error;

  const { id: lead_id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const titulo = String(body.titulo || "").trim();
  if (!titulo) return NextResponse.json({ error: "Título obrigatório" }, { status: 400 });

  const valor = Number(body.valor ?? 0);
  const tenantId = sessao.ctx.tenantId;

  const row = {
    lead_id,
    titulo,
    valor: Number.isFinite(valor) ? valor : 0,
    escopo: body.escopo ? String(body.escopo) : null,
    prazo_dias: body.prazo_dias != null ? Number(body.prazo_dias) : null,
    servico_id: body.servico_id || null,
    status: body.status || "rascunho",
    tenant_id: tenantId,
  };

  const supabase = crmDb();
  const { data, error } = await supabase.from("hub_propostas").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("hub_atividades").insert({
    lead_id,
    tipo: "proposta",
    descricao: `Proposta criada: ${titulo}`,
    feito_por: "humano",
    feito_por_tipo: "humano",
    tenant_id: tenantId,
  });

  return NextResponse.json({ data }, { status: 201 });
}
