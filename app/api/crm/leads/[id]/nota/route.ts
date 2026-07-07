import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmComercial } from "@/lib/crm/crm-api-auth";

type Params = { params: Promise<{ id: string }> };

/** Registra uma nota/atividade manual na timeline do lead (hub_atividades) — KPI-ready. */
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

  // Nota completa para o painel de notas do lead (hub_notas) — com tenant.
  const { data: nota, error: notaErr } = await supabase
    .from("hub_notas")
    .insert({
      lead_id: id,
      conteudo: descricao.slice(0, 2000),
      criado_por: "humano",
      tenant_id: tenantId,
    })
    .select("id, conteudo, criado_por, criado_em")
    .single();

  if (notaErr) return NextResponse.json({ error: notaErr.message }, { status: 500 });

  // Espelho na timeline (hub_atividades) — KPI-ready; falha aqui não derruba a nota.
  // F4 (roleplay): a ficha lê o espelho, então guardamos o texto COMPLETO (descricao é text,
  // sem limite) — antes truncava em 80 chars e a nota longa sumia da tela ("nada se perde").
  const { error: atvErr } = await supabase.from("hub_atividades").insert({
    lead_id: id,
    tipo: "nota",
    descricao: descricao.slice(0, 2000),
    feito_por: "humano",
    feito_por_tipo: "humano",
    tenant_id: tenantId,
  });
  if (atvErr) {
    console.error("[leads/nota] atividade falhou (nota gravada):", atvErr.message);
  }

  return NextResponse.json({ data: nota }, { status: 201 });
}
