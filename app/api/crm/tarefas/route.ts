import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { defaultTenantId, tenantIdFromRequest } from "@/lib/tenant-default";

const TABLE = "hub_tarefas_comerciais";
const SELECT = "id, titulo, descricao, status, prioridade, vencimento_em, lead_id, negocio_id, responsavel_id, concluida_em, criado_em";

function tableNotFound(error: { code?: string; message?: string }) {
  return error.code === "42P01" || error.message?.includes("does not exist");
}

export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();
  const status = request.nextUrl.searchParams.get("status") || "";
  const leadId = request.nextUrl.searchParams.get("lead_id") || "";
  const negocioId = request.nextUrl.searchParams.get("negocio_id") || "";

  let query = crmDb()
    .from(TABLE)
    .select(SELECT)
    .eq("tenant_id", tenantId)
    .order("vencimento_em", { ascending: true, nullsFirst: false })
    .order("criado_em", { ascending: false })
    .limit(100);

  if (status) query = query.eq("status", status);
  if (leadId) query = query.eq("lead_id", leadId);
  if (negocioId) query = query.eq("negocio_id", negocioId);

  const { data, error } = await query;
  if (error && tableNotFound(error)) return NextResponse.json({ data: [] });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const titulo = String(body.titulo || "").trim();
  if (!titulo) return NextResponse.json({ error: "Título obrigatório" }, { status: 400 });

  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();

  const row = {
    titulo,
    descricao: body.descricao || null,
    status: body.status || "aberta",
    prioridade: body.prioridade || "normal",
    vencimento_em: body.vencimento_em || null,
    lead_id: body.lead_id || null,
    negocio_id: body.negocio_id || null,
    responsavel_id: body.responsavel_id || null,
    tenant_id: tenantId,
  };

  const { data, error } = await crmDb().from(TABLE).insert(row).select(SELECT).single();
  if (error && tableNotFound(error)) {
    return NextResponse.json({ error: "Tabela de tarefas não existe. Aplique a migration." }, { status: 503 });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data }, { status: 201 });
}
