import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmComercial, requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { isTipoContrato } from "@/lib/obras/financeiro";
import { isMissingPgColumn, tenantScopeOrFilter } from "@/lib/tenant-default";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  const supabase = crmDb();
  const tenantId = g.ctx.tenantId;
  // SEGURANÇA (A5/E6): crmDb() é service-role e BYPASSA RLS — o filtro de tenant no código é a ÚNICA
  // barreira contra leitura cross-tenant. Usa o escopo do projeto (tenant atual + legados tenant_id NULL/
  // default Obra10) p/ fechar o vazamento SEM esconder dados antigos da própria base. tenant vem da sessão.
  const escopoTenant = tenantScopeOrFilter(tenantId);

  const { data: obra, error } = await supabase
    .from("hub_obras")
    .select("*")
    .eq("id", id)
    .or(escopoTenant)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!obra) return NextResponse.json({ error: "Obra não encontrada" }, { status: 404 });

  const [{ data: cronograma }, { data: diario }, { data: checkins }, { data: pedidos }, { data: ocorrencias }] =
    await Promise.all([
      supabase.from("hub_obras_cronograma").select("*").eq("obra_id", id).or(escopoTenant).order("data_prevista"),
      supabase.from("hub_obras_diario").select("*").eq("obra_id", id).or(escopoTenant).order("criado_em", { ascending: false }).limit(20),
      supabase.from("hub_operarios_checkin").select("*").eq("obra_id", id).or(escopoTenant).order("criado_em", { ascending: false }).limit(30),
      supabase.from("hub_pedidos_material").select("*").eq("obra_id", id).or(escopoTenant).order("criado_em", { ascending: false }),
      supabase.from("hub_obras_ocorrencias").select("*").eq("obra_id", id).or(escopoTenant).order("criado_em", { ascending: false }).limit(20),
    ]);

  return NextResponse.json({
    data: obra,
    cronograma: cronograma ?? [],
    diario: diario ?? [],
    checkins: checkins ?? [],
    pedidos: pedidos ?? [],
    ocorrencias: ocorrencias ?? [],
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const supabase = crmDb();

  // Posse da obra: tenant_id NULL/divergente não pertence ao caller → 404 (service-role bypassa RLS).
  const { data: obraRow } = await supabase
    .from("hub_obras")
    .select("id, tenant_id")
    .eq("id", id)
    .maybeSingle();
  if (!obraRow || obraRow.tenant_id !== g.ctx.tenantId) {
    return NextResponse.json({ error: "Obra não encontrada" }, { status: 404 });
  }

  const allowed = [
    "titulo",
    "status",
    "endereco",
    "cidade",
    "estado",
    "data_inicio",
    "data_previsao_fim",
    "tipo_contrato",
  ] as const;
  const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  // E6: tipo_contrato é IMUTÁVEL pós-1º orçamento aprovado (guard no endpoint, sem trigger).
  if ("tipo_contrato" in patch) {
    const valor = String(patch.tipo_contrato ?? "");
    if (!isTipoContrato(valor)) {
      return NextResponse.json(
        { error: "tipo_contrato inválido (administracao | preco_fechado)." },
        { status: 400 }
      );
    }
    // Se já existe orçamento APROVADO desta obra, o tipo não pode mais mudar.
    const { count, error: errCount } = await supabase
      .from("hub_obra_orcamentos")
      .select("id", { count: "exact", head: true })
      .eq("obra_id", id)
      .eq("tenant_id", g.ctx.tenantId)
      .eq("status", "aprovado");
    // Tabela ausente (migração E6 pendente) → não bloqueia (não há orçamento ainda).
    if (errCount && !isMissingPgColumn(errCount) && !/relation .*does not exist/i.test(errCount.message)) {
      return NextResponse.json({ error: errCount.message }, { status: 500 });
    }
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: "tipo_contrato_imutavel", detalhe: "A obra já tem orçamento aprovado; o tipo de contrato não pode mudar." },
        { status: 422 }
      );
    }
  }

  const { data, error } = await supabase
    .from("hub_obras")
    .update(patch)
    .eq("id", id)
    .eq("tenant_id", g.ctx.tenantId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
