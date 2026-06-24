import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { defaultTenantId, tenantIdFromRequest } from "@/lib/tenant-default";

/** Rede — Especialistas / mão de obra (sem login; cadastro interno). Formato Membros. */
const SELECT =
  "id, codigo, nome, telefone, email, cidade, uf, especialidades, especialidade_principal, disponibilidade, experiencia, tem_equipe, tamanho_equipe, verificado, criado_em";

export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();
  const verificado = request.nextUrl.searchParams.get("verificado");

  let query = crmDb()
    .from("hub_especialistas")
    .select(SELECT, { count: "exact" })
    .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
    .order("criado_em", { ascending: false })
    .limit(100);

  if (verificado === "true") query = query.eq("verificado", true);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [], total: count ?? 0 });
}

export async function POST(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const nome = String(body.nome || "").trim();
  const telefone = String(body.telefone || "").trim();
  if (!nome) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  if (telefone.replace(/\D/g, "").length < 10)
    return NextResponse.json({ error: "Telefone com DDD obrigatório" }, { status: 400 });

  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();
  const year = new Date().getFullYear();
  const { count } = await crmDb().from("hub_especialistas").select("*", { count: "exact", head: true });
  const codigo = `ESP-${year}-${String((count || 0) + 1).padStart(4, "0")}`;

  const especialidades = Array.isArray(body.especialidades) ? (body.especialidades as unknown[]) : null;

  const row = {
    codigo,
    nome,
    telefone,
    email: body.email || null,
    cidade: body.cidade || null,
    uf: body.uf || null,
    especialidades,
    especialidade_principal:
      especialidades && especialidades.length ? String(especialidades[0]) : (body.especialidade_principal || null),
    disponibilidade: body.disponibilidade || null,
    experiencia: body.experiencia || null,
    tem_equipe: body.tem_equipe === true,
    tamanho_equipe: body.tamanho_equipe ? Number(body.tamanho_equipe) : null,
    observacoes: body.observacoes || null,
    origem: "cadastro",
    tenant_id: tenantId,
  };

  const { data, error } = await crmDb().from("hub_especialistas").insert(row).select(SELECT).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
