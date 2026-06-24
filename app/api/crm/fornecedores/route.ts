import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { defaultTenantId, tenantIdFromRequest } from "@/lib/tenant-default";

/** Rede — Fornecedores (PJ por área). Formato Membros: status_acesso = homologação. */
const SELECT =
  "id, codigo, nome, tipo_pessoa, cnpj, cpf, email, telefone, area_atuacao, especialidade, mercados, regiao, cidade, estado, status_acesso, recebe_leads, criado_em";

export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();
  const status = request.nextUrl.searchParams.get("status") || "";

  let query = crmDb()
    .from("hub_fornecedores")
    .select(SELECT, { count: "exact" })
    .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
    .order("criado_em", { ascending: false })
    .limit(100);

  if (status) query = query.eq("status_acesso", status);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [], total: count ?? 0 });
}

export async function POST(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const nome = String(body.nome || "").trim();
  if (!nome) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();
  const year = new Date().getFullYear();
  const { count } = await crmDb().from("hub_fornecedores").select("*", { count: "exact", head: true });
  const codigo = `FOR-${year}-${String((count || 0) + 1).padStart(4, "0")}`;

  const mercados = Array.isArray(body.mercados) ? (body.mercados as unknown[]) : null;

  const row = {
    codigo,
    nome,
    tipo_pessoa: body.tipo_pessoa === "PF" ? "PF" : "PJ",
    cnpj: body.cnpj || null,
    cpf: body.cpf || null,
    email: body.email || null,
    telefone: body.telefone || null,
    area_atuacao: body.area_atuacao || null,
    especialidade: body.especialidade || null,
    mercados,
    mercado_principal: mercados && mercados.length ? String(mercados[0]) : null,
    regiao: body.regiao || null,
    cidade: body.cidade || null,
    estado: body.estado || body.regiao || null,
    status_acesso: body.status_acesso || "pendente",
    tenant_id: tenantId,
  };

  const { data, error } = await crmDb().from("hub_fornecedores").insert(row).select(SELECT).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
