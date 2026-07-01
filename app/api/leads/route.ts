import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prepararRowHubLeadInsert } from "@/lib/crm/lead-cadastro";
import { garantirPessoaParaLead } from "@/lib/crm/garantir-pessoa-lead";
import { DEFAULT_OBRA10_TENANT_ID, defaultTenantId, isMissingPgColumn } from "@/lib/tenant-default";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";

function db() {
  // fail-closed: sem fallback para a anon key (Batch 3).
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  // NOTA (flag pro dono): este GET segue sem guard de sessão — fora do escopo desta
  // rodada (item 5 = só o fallback de key). Ver relatório final: candidato a
  // requireCrmSessao numa próxima passada, hoje lista leads sem checar tenant/sessão.
  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  const { data, error } = await supabase
    .from("hub_leads_crm")
    .select("id, nome, telefone, origem, estagio, score, valor_estimado, agente_responsavel, humano_responsavel, criado_em, atualizado_em")
    .not("estagio", "in", "(perdido,ganho)")
    .order("score", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const body = await request.json() as Record<string, unknown>;
  if (!body.nome) return NextResponse.json({ error: "nome required" }, { status: 400 });

  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  const tenantId = defaultTenantId();

  // CÓDIGO ÚNICO (AUT-2): todo lead garante UMA hub_pessoas (dedup por CPF e/ou
  // telefone — não duplica; vincula pessoa_id ao lead). Antes esta rota legada
  // inseria lead SEM pessoa, criando lead órfão sem código PES.
  const pessoa = await garantirPessoaParaLead(supabase, tenantId, {
    nome: typeof body.nome === "string" ? body.nome : null,
    telefone: typeof body.telefone === "string" ? body.telefone : null,
    documento: typeof body.documento === "string" ? body.documento : null,
    origem: typeof body.origem === "string" ? body.origem : "outro",
  });

  const row = await prepararRowHubLeadInsert(
    supabase,
    {
      nome: body.nome,
      telefone: body.telefone ?? null,
      email: body.email ?? null,
      origem: body.origem ?? "outro",
      campanha: body.campanha ?? null,
      estagio: body.estagio ?? "novo",
      valor_estimado: body.valor_estimado ?? 0,
      score: body.score ?? 50,
      tags: body.tags ?? [],
      ...(pessoa.pessoaId ? { pessoa_id: pessoa.pessoaId } : {}),
      metadata: { origem_cadastro: "api_leads_legacy" },
    },
    { pessoa_codigo: pessoa.codigo }
  );

  let { data, error } = await supabase.from("hub_leads_crm").insert(row).select().single();

  // Schema legado sem a coluna pessoa_id → regrava o lead sem o vínculo (a pessoa
  // já foi garantida; o lead não fica órfão da gravação por causa de uma coluna).
  if (error && isMissingPgColumn(error, "pessoa_id")) {
    const { pessoa_id: _omit, ...semPessoa } = row;
    ({ data, error } = await supabase.from("hub_leads_crm").insert(semPessoa).select().single());
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// Campos que o PATCH pode alterar. Whitelist estrita: proíbe id/tenant_id/pessoa_id/codigo/
// role e qualquer campo de identidade — só dados operacionais do lead.
const LEAD_PATCH_ALLOWED = [
  "nome",
  "telefone",
  "email",
  "origem",
  "campanha",
  "estagio",
  "valor_estimado",
  "score",
  "tags",
  "agente_responsavel",
  "humano_responsavel",
  "proxima_acao",
  "proxima_acao_em",
] as const;

export async function PATCH(request: NextRequest) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = db();
  if (!supabase) return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });

  // Guard de posse: 404 se o lead for de outro tenant (service-role bypassa RLS). Legado
  // sem tenant_id (NULL/Obra10 padrão) é tratado como partilhado, mesmo critério das
  // outras rotas CRM (ver app/api/crm/pessoas/[id]/route.ts).
  const { data: existente, error: fetchErr } = await supabase
    .from("hub_leads_crm")
    .select("id, tenant_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr && !isMissingPgColumn(fetchErr, "tenant_id")) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!existente) {
    return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  }
  const tid =
    (existente as { tenant_id?: string | null }).tenant_id != null
      ? String((existente as { tenant_id?: string | null }).tenant_id).trim()
      : "";
  if (tid && tid !== g.ctx.tenantId && tid !== DEFAULT_OBRA10_TENANT_ID) {
    return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  }

  // Whitelist: só campos operacionais passam — nunca tenant_id/pessoa_id/codigo/role/id.
  const updates: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  for (const key of LEAD_PATCH_ALLOWED) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
  }

  const { error } = await supabase.from("hub_leads_crm").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
