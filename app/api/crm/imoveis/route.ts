import { NextRequest, NextResponse } from "next/server";
import { gerarCodigoSequencial, HUB_PREFIXO_CODIGO } from "@/lib/crm/codigos-rastreio";
import { requireCrmComercial, requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { sanitizarBuscaPostgrest } from "@/lib/crm/sanitizar-busca-postgrest";
import { isMissingPgColumn, tenantScopeOrFilter } from "@/lib/tenant-default";
import { crmDb as db } from "@/lib/crm/supabase-server";

export async function GET(request: NextRequest) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const supabase = db();
  const { searchParams } = new URL(request.url);
  const busca = sanitizarBuscaPostgrest(searchParams.get("busca") || "");
  const atoParam = searchParams.get("ativo");
  const ativo = atoParam !== "false"; // default true
  const tipo = searchParams.get("tipo") || "";
  const finalidade = searchParams.get("finalidade") || "";
  const status = searchParams.get("status") || "";
  const offset = parseInt(searchParams.get("offset") || "0");
  const limit = 20;
  const tenantId = g.ctx.tenantId;

  let query = supabase
    .from("hub_imoveis")
    .select(
      "id, codigo, titulo, tipo, finalidade, status, valor, cidade, estado, bairro, dormitorios, banheiros, vagas, area_total_m2, ativo, criado_em",
      { count: "exact" }
    )
    .eq("ativo", ativo)
    .or(tenantScopeOrFilter(tenantId))
    .order("criado_em", { ascending: false })
    .range(offset, offset + limit - 1);

  if (tipo) query = query.eq("tipo", tipo);
  if (finalidade) query = query.eq("finalidade", finalidade);
  if (status) query = query.eq("status", status);
  if (busca) {
    query = query.or(
      `titulo.ilike.%${busca}%,cidade.ilike.%${busca}%,bairro.ilike.%${busca}%`
    );
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Contagem REAL por finalidade sobre todo o conjunto ativo (não só a página de 20).
  let finQuery = supabase
    .from("hub_imoveis")
    .select("finalidade")
    .eq("ativo", ativo)
    .or(tenantScopeOrFilter(tenantId))
    .limit(5000);
  if (tipo) finQuery = finQuery.eq("tipo", tipo);
  if (status) finQuery = finQuery.eq("status", status);
  if (busca) {
    finQuery = finQuery.or(`titulo.ilike.%${busca}%,cidade.ilike.%${busca}%,bairro.ilike.%${busca}%`);
  }
  const { data: finData } = await finQuery;
  let venda = 0;
  let locacao = 0;
  for (const r of finData ?? []) {
    const f = String((r as { finalidade?: unknown }).finalidade ?? "");
    if (f === "venda") venda += 1;
    else if (f === "locacao") locacao += 1;
  }

  return NextResponse.json({
    data: data ?? [],
    total: count ?? 0,
    finalidade_counts: { venda, locacao },
  });
}

export async function POST(request: NextRequest) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const supabase = db();
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const titulo = String(body.titulo || "").trim();
  if (!titulo) return NextResponse.json({ error: "Título obrigatório" }, { status: 400 });

  const codigo = body.codigo || (await gerarCodigoSequencial(supabase, "hub_imoveis", HUB_PREFIXO_CODIGO.imovel));

  const row = {
    codigo,
    titulo,
    tipo: body.tipo || "apartamento",
    finalidade: body.finalidade || "venda",
    status: body.status || "disponivel", // 'captacao' viola hub_imoveis_status_check → 23514 (IM1 do laudo)
    valor: body.valor != null ? Number(body.valor) : null,
    cidade: body.cidade || null,
    estado: body.estado || null,
    bairro: body.bairro || null,
    dormitorios: body.dormitorios != null ? Number(body.dormitorios) : null,
    area_total_m2: body.area_total_m2 != null ? Number(body.area_total_m2) : null,
    ativo: body.ativo !== false,
    tenant_id: g.ctx.tenantId,
  };

  let { data, error } = await supabase.from("hub_imoveis").insert(row).select().single();
  if (error && isMissingPgColumn(error, "tenant_id")) {
    const { tenant_id: _omit, ...semTenant } = row;
    ({ data, error } = await supabase.from("hub_imoveis").insert(semTenant).select().single());
  }
  if (error) {
    console.error("[imoveis] POST falhou:", error.message); // não expõe SQL cru ao cliente (AP2/IM2)
    return NextResponse.json({ error: "Não foi possível salvar o imóvel." }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}
