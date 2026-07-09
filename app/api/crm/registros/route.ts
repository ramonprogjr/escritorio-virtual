import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { getCallerContext, requireCrmComercial } from "@/lib/crm/crm-api-auth";
import { registrarAtividade } from "@/lib/crm/registrar-atividade";

/**
 * Registros/timeline UNIVERSAL de qualquer entidade (hub_atividades via entity_type+entity_id).
 * Cobre as fichas que NÃO tinham nota (pessoa/empresa/fornecedor/especialista/obra); lead e negócio
 * mantêm suas rotas próprias. GET = timeline; POST = nota manual do usuário.
 */

const ENTIDADES = new Set(["lead", "pessoa", "empresa", "negocio", "fornecedor", "especialista", "obra"]);

export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const g = await getCallerContext(request);
  if ("error" in g) return g.error;

  const url = new URL(request.url);
  const entity_type = (url.searchParams.get("entity_type") || "").trim();
  const entity_id = (url.searchParams.get("entity_id") || "").trim();
  if (!ENTIDADES.has(entity_type) || !entity_id) {
    return NextResponse.json({ error: "entity_type/entity_id inválidos" }, { status: 400 });
  }

  const supabase = crmDb();
  const { data, error } = await supabase
    .from("hub_atividades")
    .select("id, tipo, descricao, feito_por, feito_por_tipo, metadata, criado_em")
    .eq("entity_type", entity_type)
    .eq("entity_id", entity_id)
    .eq("tenant_id", g.ctx.tenantId)
    .order("criado_em", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  let body: { entity_type?: string; entity_id?: string; descricao?: string; tipo?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const entity_type = (body.entity_type || "").trim();
  const entity_id = (body.entity_id || "").trim();
  if (!ENTIDADES.has(entity_type) || !entity_id) {
    return NextResponse.json({ error: "entity_type/entity_id inválidos" }, { status: 400 });
  }
  if (!body.descricao?.trim()) {
    return NextResponse.json({ error: "Informe o texto da nota." }, { status: 400 });
  }

  const r = await registrarAtividade(crmDb(), {
    entity_type,
    entity_id,
    tipo: body.tipo?.trim() || "nota",
    descricao: body.descricao,
    feito_por: g.ctx.userId || "humano",
    feito_por_tipo: "humano",
    tenant_id: g.ctx.tenantId,
  });
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
