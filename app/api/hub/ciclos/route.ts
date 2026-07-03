import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { validateAndNormalizeCicloConfiguracoes } from "@/lib/hub-ciclos-configuracoes";
import { requireCrmGestor, requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { sanitizarBuscaPostgrest } from "@/lib/crm/sanitizar-busca-postgrest";

type CicloTipo = "continuo" | "programado" | "gatilho";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function isCicloTipo(v: unknown): v is CicloTipo {
  return v === "continuo" || v === "programado" || v === "gatilho";
}

export async function GET(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  // E-B7 (GET): guard de sessão + filtro de tenant. Sem guard listava ciclos de TODOS os tenants.
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const supabase = db();
  const { searchParams } = new URL(request.url);
  const ativo = searchParams.get("ativo");
  const agenteSlug = searchParams.get("agente_slug");
  const tipo = searchParams.get("tipo");
  // Sanitiza o termo livre antes de interpolar no `.or(...ilike...)` — sem isso, um `q`
  // malicioso injeta condições PostgREST (ex.: `,tenant_id.eq.<outro>`) e escapa do filtro
  // de tenant. Mesmo tratamento das 6 rotas de busca (pessoas/negocios/imoveis/empresas/...).
  const q = sanitizarBuscaPostgrest(searchParams.get("q") || "");

  // Tenant SEMPRE da sessão — nunca do header (forjável).
  let query = supabase
    .from("hub_ciclos_ia")
    .select("*")
    .eq("tenant_id", g.ctx.tenantId)
    .order("agente_slug")
    .order("nome");

  if (ativo === "true") query = query.eq("ativo", true);
  if (ativo === "false") query = query.eq("ativo", false);
  if (agenteSlug) query = query.eq("agente_slug", agenteSlug);
  if (tipo && isCicloTipo(tipo)) query = query.eq("tipo", tipo);
  if (q) query = query.or(`nome.ilike.%${q}%,descricao.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) {
    // Tolerância: se tenant_id não existir na tabela ainda (base antiga), cai sem filtro.
    if (/tenant_id/i.test(error.message)) {
      let fallbackQ = supabase.from("hub_ciclos_ia").select("*").order("agente_slug").order("nome");
      if (ativo === "true") fallbackQ = fallbackQ.eq("ativo", true);
      if (ativo === "false") fallbackQ = fallbackQ.eq("ativo", false);
      if (agenteSlug) fallbackQ = fallbackQ.eq("agente_slug", agenteSlug);
      if (tipo && isCicloTipo(tipo)) fallbackQ = fallbackQ.eq("tipo", tipo);
      const { data: fd, error: fe } = await fallbackQ;
      if (fe) return NextResponse.json({ error: fe.message }, { status: 500 });
      return NextResponse.json({ ciclos: fd || [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ciclos: data || [] });
}

export async function POST(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  // E-B7 (POST): criar ciclo exige gestor + tenant da sessão.
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const agente_slug = typeof body.agente_slug === "string" ? body.agente_slug.trim() : "";
  const nome = typeof body.nome === "string" ? body.nome.trim() : "";
  const descricao =
    typeof body.descricao === "string" && body.descricao.trim().length > 0
      ? body.descricao.trim()
      : null;
  const tipo = body.tipo;

  if (!agente_slug || !nome || !isCicloTipo(tipo)) {
    return NextResponse.json(
      { error: "agente_slug, nome e tipo (continuo/programado/gatilho) são obrigatórios." },
      { status: 400 }
    );
  }

  const intervalo =
    body.intervalo_minutos == null ? null : Number.parseInt(String(body.intervalo_minutos), 10);
  if (intervalo != null && (!Number.isFinite(intervalo) || intervalo <= 0)) {
    return NextResponse.json({ error: "intervalo_minutos inválido." }, { status: 400 });
  }

  const cron =
    typeof body.cron_expressao === "string" && body.cron_expressao.trim().length > 0
      ? body.cron_expressao.trim()
      : null;
  const parsedCfg = validateAndNormalizeCicloConfiguracoes(
    body.configuracoes && typeof body.configuracoes === "object" && !Array.isArray(body.configuracoes) ? body.configuracoes : {}
  );
  if (!parsedCfg.ok) {
    return NextResponse.json({ error: parsedCfg.error }, { status: 400 });
  }
  const configuracoes = parsedCfg.value;

  const row = {
    agente_slug,
    nome,
    descricao,
    tipo,
    cron_expressao: cron,
    intervalo_minutos: intervalo,
    ativo: body.ativo === false ? false : true,
    configuracoes,
    // E-B7: tenant_id SEMPRE da sessão — garante isolamento multi-tenant.
    tenant_id: g.ctx.tenantId,
  };

  const supabase = db();
  let { data, error } = await supabase.from("hub_ciclos_ia").insert(row).select("*").single();

  // Tolerância: base antiga sem coluna tenant_id — repete sem ela (isolamento degrada p/ legado).
  if (error && /tenant_id/i.test(error.message || "")) {
    const { tenant_id, ...rowSemTenant } = row;
    ({ data, error } = await supabase.from("hub_ciclos_ia").insert(rowSemTenant).select("*").single());
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
