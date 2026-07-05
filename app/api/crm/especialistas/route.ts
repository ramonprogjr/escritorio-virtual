import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmComercial, requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { gerarCodigoSequencial } from "@/lib/crm/codigos-rastreio";

/** Rede — Especialistas / mão de obra (sem login; cadastro interno). Formato Membros. */
const SELECT =
  "id, codigo, nome, telefone, email, cidade, uf, especialidades, especialidade_principal, disponibilidade, experiencia, tem_equipe, tamanho_equipe, verificado, criado_em";

export async function GET(request: NextRequest) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const tenantId = g.ctx.tenantId;
  const verificado = request.nextUrl.searchParams.get("verificado");

  let query = crmDb()
    .from("hub_especialistas")
    .select(SELECT, { count: "exact" })
    // Escopo ESTRITO ao tenant da sessão — `.eq` PURO (nunca `.or(...is.null)`, que sob
    // service_role casaria linhas órfãs/legadas de OUTRO tenant = over-share cross-tenant).
    .eq("tenant_id", tenantId)
    .order("criado_em", { ascending: false })
    .limit(100);

  if (verificado === "true") query = query.eq("verificado", true);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [], total: count ?? 0 });
}

export async function POST(request: NextRequest) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const nome = String(body.nome || "").trim();
  const telefone = String(body.telefone || "").trim();
  if (!nome) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  if (telefone.replace(/\D/g, "").length < 10)
    return NextResponse.json({ error: "Telefone com DDD obrigatório" }, { status: 400 });

  const tenantId = g.ctx.tenantId;

  // Dedup de CPF ESTRITO ao tenant da sessão — `.eq("tenant_id")` PURO (nunca `.or(is.null)`,
  // que sob service_role casaria linhas órfãs/legadas de OUTRO tenant = vazamento/oráculo do
  // nome de especialista de outra empresa). A verificação fica restrita ao escopo do caller.
  const cpf = String(body.cpf || "").replace(/\D/g, "") || null;
  if (cpf) {
    const { data: dup } = await crmDb()
      .from("hub_especialistas")
      .select("id, nome")
      .eq("cpf", cpf)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (dup)
      return NextResponse.json({ error: "Já existe um especialista com este CPF na rede." }, { status: 409 });
  }

  // Código ATÔMICO (rpc crm_proximo_codigo, contador por entidade/ano) — sem corrida
  // sob rajada. Fallback degradado (ESP-AAAA-####) só se a rpc estiver indisponível.
  const codigo = await gerarCodigoSequencial(crmDb(), "hub_especialistas", "ESP");

  const especialidades = Array.isArray(body.especialidades) ? (body.especialidades as unknown[]) : null;

  const row = {
    codigo,
    nome,
    telefone,
    cpf,
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
    cadastrado_por: g.ctx.userId,
    tenant_id: tenantId,
  };

  const { data, error } = await crmDb().from("hub_especialistas").insert(row).select(SELECT).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
