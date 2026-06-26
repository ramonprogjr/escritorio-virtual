import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmComercial } from "@/lib/crm/crm-api-auth";

type Params = { params: Promise<{ id: string }> };

/** Registra uma nota/atividade manual na timeline do negócio (hub_atividades). */
export async function POST(request: NextRequest, { params }: Params) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const descricao = String(body.descricao || "").trim();
  if (!descricao) return NextResponse.json({ error: "Escreva a nota." }, { status: 400 });

  const supabase = crmDb();
  const tenantId = g.ctx.tenantId;

  // Confirma que o negócio existe E pertence ao tenant do chamador (null-safe).
  const { data: neg } = await supabase
    .from("hub_negocios")
    .select("lead_id, tenant_id")
    .eq("id", id)
    .maybeSingle();
  if (!neg) return NextResponse.json({ error: "Negócio não encontrado" }, { status: 404 });
  if (neg.tenant_id && neg.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Negócio não encontrado" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("hub_atividades")
    .insert({
      negocio_id: id,
      lead_id: neg.lead_id ?? null,
      tipo: "nota",
      descricao: descricao.slice(0, 2000),
      feito_por: "humano",
      feito_por_tipo: "humano",
      tenant_id: tenantId,
    })
    .select("id, tipo, descricao, criado_em")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
