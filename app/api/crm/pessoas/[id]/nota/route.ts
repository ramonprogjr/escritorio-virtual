import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmComercial, requireCrmSessao } from "@/lib/crm/crm-api-auth";

type Params = { params: Promise<{ id: string }> };

const SELECT = "id, tipo, descricao, feito_por, feito_por_tipo, criado_em";

/** Timeline de registros (hub_atividades) da pessoa/empresa — KPI-ready. */
export async function GET(request: NextRequest, { params }: Params) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  const { data, error } = await crmDb()
    .from("hub_atividades")
    .select(SELECT)
    .eq("pessoa_id", id)
    .order("criado_em", { ascending: false })
    .limit(80);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

/** Registra uma nota manual na timeline da pessoa/empresa. */
export async function POST(request: NextRequest, { params }: Params) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const descricao = String(body.descricao || "").trim();
  if (!descricao) return NextResponse.json({ error: "Escreva a nota." }, { status: 400 });

  const { data, error } = await crmDb()
    .from("hub_atividades")
    .insert({
      pessoa_id: id,
      tipo: "nota",
      descricao: descricao.slice(0, 2000),
      feito_por: "humano",
      feito_por_tipo: "humano",
      tenant_id: g.ctx.tenantId,
    })
    .select(SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
