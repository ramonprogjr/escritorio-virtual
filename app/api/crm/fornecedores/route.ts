import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { gerarCodigoSequencial } from "@/lib/crm/codigos-rastreio";
import { defaultTenantId } from "@/lib/tenant-default";
import { rateLimitExcedido } from "@/lib/rate-limit-memoria";

/** Rede — Fornecedores (PJ por área). Formato Membros: status_acesso = homologação. */
const SELECT =
  "id, codigo, nome, tipo_pessoa, cnpj, cpf, email, telefone, area_atuacao, especialidade, mercados, regiao, cidade, estado, status_acesso, recebe_leads, criado_em";

export async function GET(request: NextRequest) {
  // Leitura com service-role (ignora RLS): exige sessão CRM e usa o tenant do
  // operador logado como escopo — alinha com /api/crm/especialistas e /projetos.
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const tenantId = g.ctx.tenantId;
  const status = request.nextUrl.searchParams.get("status") || "";

  let query = crmDb()
    .from("hub_fornecedores")
    .select(SELECT, { count: "exact" })
    // Escopo ESTRITO ao tenant — `.eq` puro (nunca `.or(...is.null)`, que sob service_role
    // casaria linhas orfas/legadas de OUTRO tenant = over-share cross-tenant).
    .eq("tenant_id", tenantId)
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

  // Captação é PÚBLICA mas o marketing é HUB-only: rate-limit anti-spam por IP, e o tenant
  // é SEMPRE o do Hub (defaultTenantId) — nunca do header (era forjável → escrita cross-tenant).
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconhecido";
  if (rateLimitExcedido(`captacao:fornecedor:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde um instante." }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const nome = String(body.nome || "").trim().slice(0, 200);
  if (!nome) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  const tenantId = defaultTenantId();
  // Código ATÔMICO (rpc crm_proximo_codigo, contador por entidade/ano) — sem corrida
  // sob rajada. Fallback degradado (FOR-AAAA-####) só se a rpc estiver indisponível.
  const codigo = await gerarCodigoSequencial(crmDb(), "hub_fornecedores", "FOR");

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
    recebe_leads: body.recebe_leads === true,
    tenant_id: tenantId,
  };

  const { data, error } = await crmDb().from("hub_fornecedores").insert(row).select(SELECT).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
