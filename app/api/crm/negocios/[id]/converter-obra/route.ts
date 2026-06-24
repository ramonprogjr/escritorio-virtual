import { NextRequest, NextResponse } from "next/server";
import { registrarLogCrm } from "@/lib/crm/audit-log";
import { resolverTipoDerivado } from "@/lib/crm/derivar-negocio";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { defaultTenantId, tenantIdFromRequest } from "@/lib/tenant-default";

type Params = { params: Promise<{ id: string }> };

/**
 * fn-derivados — deriva uma Obra ou Projeto de um negócio GANHO (caminho de valor
 * Negócio → Obra/Projeto). Regra: por mercado (ARQ/MRC → projeto; resto → obra),
 * com override via body.tipo_alvo ('obra' | 'projeto'). Idempotente: se já houver
 * derivado para o negócio, retorna o existente (não duplica).
 */
export async function POST(request: NextRequest, { params }: Params) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  const supabase = crmDb();
  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const override = typeof body.tipo_alvo === "string" ? body.tipo_alvo : "";

  const { data: negocio, error: negErr } = await supabase
    .from("hub_negocios")
    .select("id, codigo, titulo, prefixo_mercado, status, etapa, lead_id, tenant_id")
    .eq("id", id)
    .maybeSingle();

  if (negErr) return NextResponse.json({ error: negErr.message }, { status: 500 });
  if (!negocio) return NextResponse.json({ error: "Negócio não encontrado" }, { status: 404 });

  // "Ganho" pode vir como status (fechado_ganho) ou como etapa (ganho) — a UI marca por etapa.
  const ganho =
    String(negocio.status) === "fechado_ganho" || String(negocio.etapa) === "ganho";
  if (!ganho) {
    return NextResponse.json(
      { error: "Apenas negócios ganhos geram obra/projeto." },
      { status: 409 }
    );
  }

  const alvo = resolverTipoDerivado(negocio.prefixo_mercado as string, override);

  const tabela = alvo === "projeto" ? "hub_projetos" : "hub_obras";

  // Idempotência: já existe derivado para este negócio?
  const { data: existente } = await supabase
    .from(tabela)
    .select("id, codigo")
    .eq("negocio_id", id)
    .limit(1)
    .maybeSingle();

  if (existente?.id) {
    return NextResponse.json({ data: existente, tipo: alvo, ja_existia: true });
  }

  const titulo = String(negocio.titulo || `Negócio ${negocio.codigo ?? id}`).slice(0, 200);
  const year = new Date().getFullYear();
  const { count } = await supabase.from(tabela).select("*", { count: "exact", head: true });
  const prefixoCodigo = alvo === "projeto" ? "PRJ" : "OBR";
  const codigo = `${prefixoCodigo}-${year}-${String((count || 0) + 1).padStart(4, "0")}`;

  const row =
    alvo === "projeto"
      ? { codigo, titulo, status: "briefing", negocio_id: id, tenant_id: tenantId }
      : { codigo, titulo, status: "planejamento", negocio_id: id, tenant_id: tenantId };

  const { data: criado, error: insErr } = await supabase
    .from(tabela)
    .insert(row)
    .select("id, codigo, titulo, status, negocio_id")
    .single();

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  await supabase.from("hub_atividades").insert({
    negocio_id: id,
    lead_id: negocio.lead_id ?? null,
    tipo: "derivacao",
    descricao: `Negócio ganho → ${alvo === "projeto" ? "Projeto" : "Obra"} ${criado.codigo}`,
    feito_por: "humano",
    feito_por_tipo: "humano",
    tenant_id: tenantId,
  });

  await registrarLogCrm(supabase, {
    entidade: "negocio",
    entidade_id: id,
    acao: alvo === "projeto" ? "derivou_projeto" : "derivou_obra",
    valor_anterior: null,
    valor_novo: String(criado.codigo),
    motivo: null,
    tenant_id: tenantId,
  });

  return NextResponse.json({ data: criado, tipo: alvo, ja_existia: false }, { status: 201 });
}
