import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmComercial, requireCrmSessao } from "@/lib/crm/crm-api-auth";

const SELECT =
  "id, codigo, obra_id, descricao, status, valor_estimado, solicitado_por, criado_em, atualizado_em";

export async function GET(request: NextRequest) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const tenantId = g.ctx.tenantId;
  const obraId = request.nextUrl.searchParams.get("obra_id");

  let query = crmDb()
    .from("hub_pedidos_material")
    .select(SELECT)
    .eq("tenant_id", tenantId)
    .order("criado_em", { ascending: false })
    .limit(100);

  if (obraId) query = query.eq("obra_id", obraId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const descricao = String(body.descricao || "").trim();
  if (!descricao) return NextResponse.json({ error: "Descrição obrigatória" }, { status: 400 });

  const tenantId = g.ctx.tenantId;
  const supabase = crmDb();

  // SEGURANÇA (FASE 0.1): esta porta NUNCA aceita status do body. Sem allowlist, um caller criava a SC já
  // 'aprovado', PULANDO a cadeia de validação inteira — e a RPC de entrega passava a autorizar a fraude.
  // A aprovação só existe pelo gate humano (PATCH acao='aprovar'). Aqui só nasce rascunho/cotando.
  const statusPedido = body.status === "cotando" ? "cotando" : "rascunho";

  // Código atômico POR TENANT (RPC gerar_codigo_sc) — o antigo contador COUNT(*) sem filtro de tenant
  // vazava a contagem entre empresas E colidia códigos sob concorrência. Degrada p/ timestamp se a RPC faltar.
  let codigo = `SC-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
  const { data: codigoRpc, error: errCodigo } = await supabase.rpc("gerar_codigo_sc", { p_tenant: tenantId });
  if (!errCodigo && typeof codigoRpc === "string" && codigoRpc.trim()) codigo = codigoRpc.trim();

  const { data, error } = await supabase
    .from("hub_pedidos_material")
    .insert({
      codigo,
      descricao,
      obra_id: body.obra_id || null,
      status: statusPedido,
      valor_estimado: body.valor_estimado != null ? Number(body.valor_estimado) : null,
      solicitado_por: body.solicitado_por || null,
      tenant_id: tenantId,
    })
    .select(SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
