import { type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { gerarCodigoPessoa } from "@/lib/crm/pessoa-cadastro";
import {
  montarMetadataLeadMercados,
  prepararRowHubLeadInsert,
  validarLeadCadastro,
} from "@/lib/crm/lead-cadastro";
import { isMissingPgColumn, tenantScopeOrFilter } from "@/lib/tenant-default";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { sanitizarBuscaPostgrest } from "@/lib/crm/sanitizar-busca-postgrest";
import { registrarEvento } from "@/lib/crm/registrar-evento";
import { crmDb as db, crmConfigError as supabaseConfigError } from "@/lib/crm/supabase-server";

const LEAD_INSERT_SELECT =
  "id, codigo, nome, telefone, email, origem, estagio, score, valor_estimado, pessoa_id, criado_em, atualizado_em";

async function vincularPessoaPorTelefone(
  supabase: SupabaseClient,
  telefone: string,
  nome: string,
  origem: string,
  mercados: string[],
  tenantId: string
): Promise<string | null> {
  // Busca e gravação SEMPRE escopadas no tenant — senão um lead do tenant A
  // se vincula a pessoa do tenant B (vazamento) e pessoa nova nasce órfã (tenant NULL).
  const buscar = async () =>
    (
      await supabase
        .from("hub_pessoas")
        .select("id")
        .eq("telefone", telefone)
        .or(tenantScopeOrFilter(tenantId))
        .maybeSingle()
    ).data;

  const existente = await buscar();
  if (existente?.id) return existente.id as string;

  const codigo = await gerarCodigoPessoa(supabase);

  const { data: nova, error } = await supabase
    .from("hub_pessoas")
    .insert({
      codigo,
      nome: nome.slice(0, 200),
      telefone,
      tipo: "lead",
      origem: origem || "crm_manual",
      tenant_id: tenantId,
      dados_extras: { mercados },
    })
    .select("id")
    .single();

  // Corrida: o UNIQUE de telefone bate (23505) → re-buscar a existente no tenant.
  if ((error as { code?: string } | null)?.code === "23505") {
    const r = await buscar();
    if (r?.id) return r.id as string;
  }
  if (error || !nova) return null;
  return nova.id as string;
}

async function insertHubLead(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
  tenantId: string
) {
  const variants: Record<string, unknown>[] = [
    { ...row, tenant_id: tenantId },
    { ...row, tenant_id: tenantId, pessoa_id: undefined },
    { ...row },
  ];
  const noPessoa = { ...row };
  delete noPessoa.pessoa_id;
  variants.push({ ...noPessoa, tenant_id: tenantId }, { ...noPessoa });

  let lastError: { message?: string; code?: string } | null = null;

  for (const payload of variants) {
    const clean = { ...payload };
    if (clean.pessoa_id === undefined) delete clean.pessoa_id;

    const { data, error } = await supabase
      .from("hub_leads_crm")
      .insert(clean)
      .select(LEAD_INSERT_SELECT)
      .single();

    if (!error) return { data, error: null };

    lastError = error;
    const code = "code" in error ? String(error.code) : "";
    const msg = "message" in error ? String(error.message) : "";
    if (code === "PGRST205" || msg.includes("hub_leads_crm")) {
      return {
        data: null,
        error: {
          message:
            "Tabela hub_leads_crm nao existe no Supabase. Execute a migracao 20260522130000_ensure_hub_leads_crm.sql no SQL Editor.",
          code,
        },
      };
    }
    if (
      !isMissingPgColumn(error, "tenant_id") &&
      !isMissingPgColumn(error, "pessoa_id") &&
      !isMissingPgColumn(error, "codigo")
    ) {
      return { data: null, error };
    }
  }

  return {
    data: null,
    error: lastError ?? { message: "Falha ao gravar hub_leads_crm." },
  };
}

/** Lista enxuta para selects (ex.: formulário de negócio). */
export async function GET(request: NextRequest) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const configErr = supabaseConfigError();
  if (configErr) {
    return NextResponse.json(
      { error: "CRM indisponivel: Supabase nao configurado no servidor.", detail: configErr },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
  const busca = sanitizarBuscaPostgrest(searchParams.get("busca") || "");

  const supabase = db();
  let query = supabase
    .from("hub_leads_crm")
    .select("id, nome, telefone, estagio, valor_estimado, criado_em")
    .not("estagio", "in", "(ganho,perdido)")
    .or(tenantScopeOrFilter(g.ctx.tenantId))
    .order("criado_em", { ascending: false })
    .limit(limit);

  if (busca) {
    query = query.or(`nome.ilike.%${busca}%,telefone.ilike.%${busca}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const configErr = supabaseConfigError();
  if (configErr) {
    return NextResponse.json(
      { error: "CRM indisponivel: Supabase nao configurado no servidor.", detail: configErr },
      { status: 503 }
    );
  }

  const supabase = db();
  const tenantId = g.ctx.tenantId;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const validacao = validarLeadCadastro(body);
  if (!validacao.ok) {
    return NextResponse.json({ error: validacao.erro }, { status: 400 });
  }

  const d = validacao.data;

  if (d.telefone) {
    // Dedup restrita ao tenant da sessão (+ legados sem tenant) — não vaza/colide cross-tenant.
    const { data: dup } = await supabase
      .from("hub_leads_crm")
      .select("id, nome")
      .eq("telefone", d.telefone)
      .or(tenantScopeOrFilter(tenantId))
      .maybeSingle();

    if (dup) {
      return NextResponse.json(
        { error: `Telefone já cadastrado para o lead ${dup.nome}.`, lead_id: dup.id },
        { status: 409 }
      );
    }
  }

  const indicadoPor =
    typeof body.indicado_por === "string" && body.indicado_por.trim()
      ? body.indicado_por.trim()
      : null;

  let pessoa_id: string | null = null;
  if (d.telefone) {
    pessoa_id = await vincularPessoaPorTelefone(
      supabase,
      d.telefone,
      d.nome,
      d.origem,
      d.mercados,
      tenantId
    );
  }

  let pessoa_codigo: string | null = null;
  if (pessoa_id) {
    const { data: pe } = await supabase
      .from("hub_pessoas")
      .select("codigo")
      .eq("id", pessoa_id)
      .maybeSingle();
    pessoa_codigo = pe?.codigo != null ? String(pe.codigo) : null;
  }

  const now = new Date().toISOString();
  const rowBase: Record<string, unknown> = {
    nome: d.nome,
    telefone: d.telefone,
    email: d.email,
    origem: d.origem,
    estagio: d.estagio,
    valor_estimado: d.valor_estimado,
    score: 50,
    pessoa_id,
    criado_em: now,
    atualizado_em: now,
    metadata: montarMetadataLeadMercados({
      mercados: d.mercados,
      origem_cadastro: "crm_manual",
      indicado_por: indicadoPor,
    }),
  };

  const row = await prepararRowHubLeadInsert(supabase, rowBase, { pessoa_codigo });

  const { data: created, error } = await insertHubLead(supabase, row, tenantId);

  if (error) {
    const detail = "message" in error ? String(error.message) : "Erro desconhecido";
    const code = "code" in error ? String(error.code) : "";
    if (code === "23505") {
      return NextResponse.json({ error: "Lead duplicado (telefone já existe)." }, { status: 409 });
    }
    const status = code === "PGRST205" ? 503 : 500;
    return NextResponse.json({ error: detail, detail }, { status });
  }

  if (created?.id) {
    await supabase.from("hub_atividades").insert({
      lead_id: created.id,
      tipo: "status_change",
      descricao: "Lead criado manualmente no CRM",
      feito_por: "humano",
      feito_por_tipo: "humano",
    });

    // Keystone F4 (hub_eventos): instrumentação best-effort — nunca bloqueia a criação do lead.
    await registrarEvento(supabase, {
      event_type: "lead_criado",
      entity_type: "lead",
      entity_id: String(created.id),
      lead_id: String(created.id),
      ator: "humano",
      payload: { origem: d.origem, estagio: d.estagio },
      tenant_id: tenantId,
    });
  }

  return NextResponse.json({ data: created }, { status: 201 });
}
