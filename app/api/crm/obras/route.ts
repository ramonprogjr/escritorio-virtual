import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmComercial, requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { isMissingPgColumn } from "@/lib/tenant-default";
import { TIPOS_OBRA } from "@/lib/obras/eap-presets";
import {
  criarObraComEAP,
  SELECT_OBRA_E0 as SELECT_E0,
  SELECT_OBRA_LEGADO as SELECT_LEGADO,
} from "@/lib/obras/criar-obra-com-eap";

const TIPOS_VALIDOS = new Set<string>(TIPOS_OBRA.map((t) => t.slug));

export async function GET(request: NextRequest) {
  // AUDITORIA-FIX: auth unificado em requireCrm* (era tenantIdFromRequest, divergente de /projetos).
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const tenantId = g.ctx.tenantId;
  const status = request.nextUrl.searchParams.get("status") || "";
  const tipo = request.nextUrl.searchParams.get("tipo") || "";
  const negocioId = request.nextUrl.searchParams.get("negocio_id") || "";

  function montarQuery(select: string) {
    let q = crmDb()
      .from("hub_obras")
      .select(select, { count: "exact" })
      .eq("tenant_id", tenantId)
      .order("criado_em", { ascending: false })
      .limit(100);
    if (status) q = q.eq("status", status);
    if (negocioId) q = q.eq("negocio_id", negocioId);
    return q;
  }

  let query = montarQuery(SELECT_E0);
  if (tipo && TIPOS_VALIDOS.has(tipo)) query = query.eq("tipo_obra", tipo);

  let { data, error, count } = await query;

  // Tolerância: migração E0 ainda não aplicada → cai no SELECT legado, sem filtro de tipo.
  if (error && isMissingPgColumn(error)) {
    ({ data, error, count } = await montarQuery(SELECT_LEGADO));
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [], total: count ?? 0 });
}

export async function POST(request: NextRequest) {
  // AUDITORIA-FIX: comercial+ pela sessão (era header-based frouxo).
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const titulo = String(body.titulo || "").trim();
  if (!titulo) return NextResponse.json({ error: "Título obrigatório" }, { status: 400 });

  const tenantId = g.ctx.tenantId;
  const supabase = crmDb();

  // A2: lógica de criação extraída para `criarObraComEAP()` (compartilhada com /gerar-obra),
  // SEM mudança de comportamento — dedup 60s, código atômico, retry 23505, EAP do preset
  // e tolerância à migração E0 ausente continuam idênticos.
  const res = await criarObraComEAP(supabase, tenantId, {
    titulo,
    tipo_obra: typeof body.tipo_obra === "string" ? body.tipo_obra : null,
    negocio_id: typeof body.negocio_id === "string" ? body.negocio_id : null,
    imovel_id: typeof body.imovel_id === "string" ? body.imovel_id : null,
    cliente_pessoa_id: typeof body.cliente_pessoa_id === "string" ? body.cliente_pessoa_id : null,
    cliente_empresa_id: typeof body.cliente_empresa_id === "string" ? body.cliente_empresa_id : null,
    status: typeof body.status === "string" ? body.status : null,
    endereco: typeof body.endereco === "string" ? body.endereco : null,
    cidade: typeof body.cidade === "string" ? body.cidade : null,
    estado: typeof body.estado === "string" ? body.estado : null,
    area_total_m2: typeof body.area_total_m2 === "number" ? body.area_total_m2 : null,
    valor_contrato: typeof body.valor_contrato === "number" ? body.valor_contrato : null,
    frentes_selecionadas: body.frentes_selecionadas,
  });

  if (!res.ok) {
    const code = res.erro === "Título obrigatório" ? 400 : 500;
    return NextResponse.json({ error: res.erro }, { status: code });
  }

  // Idempotência leve (anti double-tap): mesma resposta 200 do comportamento original.
  if (res.idempotente) {
    return NextResponse.json({ data: res.obra, idempotente: true }, { status: 200 });
  }

  return NextResponse.json(
    { data: res.obra, frentes_criadas: res.frentes_criadas, aviso: res.aviso },
    { status: 201 }
  );
}
