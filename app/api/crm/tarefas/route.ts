import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { getCallerContext, requireCrmComercial } from "@/lib/crm/crm-api-auth";
import { criarTarefa, concluirTarefa } from "@/lib/crm/registrar-tarefa";

/** Lista tarefas do tenant (universal: qualquer entity). */
export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const g = await getCallerContext(request);
  if ("error" in g) return g.error;
  const tenantId = g.ctx.tenantId;

  const url = new URL(request.url);
  const entityType = url.searchParams.get("entity_type");
  const entityId = url.searchParams.get("entity_id");
  const incluirConcluidas = url.searchParams.get("concluidas") === "1";

  const supabase = crmDb();
  let query = supabase
    .from("hub_tarefas_comerciais")
    .select("id, titulo, descricao, status, prioridade, origem, entity_type, entity_id, lead_id, negocio_id, responsavel_id, vencimento_em, concluida_em, criado_em")
    .eq("tenant_id", tenantId)
    .order("vencimento_em", { ascending: true, nullsFirst: false })
    .limit(200);

  if (entityType) query = query.eq("entity_type", entityType);
  if (entityId) query = query.eq("entity_id", entityId);
  if (!incluirConcluidas) query = query.neq("status", "concluida");

  const { data, error } = await query;
  if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
    return NextResponse.json({ data: [] });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

/** Cria uma tarefa manual (humano) em qualquer entidade. A IA usa o helper direto (ferramenta). */
export async function POST(request: NextRequest) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  let body: {
    titulo?: string; descricao?: string; entity_type?: string; entity_id?: string;
    lead_id?: string; negocio_id?: string; responsavel_id?: string; prioridade?: string; vencimento_em?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.titulo?.trim()) return NextResponse.json({ error: "Informe o título da tarefa." }, { status: 400 });

  const r = await criarTarefa(crmDb(), {
    titulo: body.titulo,
    descricao: body.descricao ?? null,
    entity_type: body.entity_type ?? null,
    entity_id: body.entity_id ?? null,
    lead_id: body.lead_id ?? null,
    negocio_id: body.negocio_id ?? null,
    responsavel_id: body.responsavel_id ?? null,
    prioridade: body.prioridade,
    vencimento_em: body.vencimento_em ?? null,
    origem: "humano",
    ator: g.ctx.userId || "humano",
    tenant_id: g.ctx.tenantId,
  });
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}

/** Conclui (ou reabre) uma tarefa. */
export async function PATCH(request: NextRequest) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  let body: { id?: string; acao?: "concluir" | "reabrir" };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: "Informe o id da tarefa." }, { status: 400 });

  const supabase = crmDb();
  // Escopo de tenant: só age em tarefa do próprio tenant.
  const { data: alvo } = await supabase
    .from("hub_tarefas_comerciais")
    .select("id, tenant_id")
    .eq("id", body.id)
    .maybeSingle();
  if (!alvo || (alvo.tenant_id && alvo.tenant_id !== g.ctx.tenantId)) {
    return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
  }

  if (body.acao === "reabrir") {
    const { error } = await supabase
      .from("hub_tarefas_comerciais")
      .update({ status: "aberta", concluida_em: null, atualizado_em: new Date().toISOString() })
      .eq("id", body.id);
    return error
      ? NextResponse.json({ error: error.message }, { status: 400 })
      : NextResponse.json({ ok: true, id: body.id });
  }

  const r = await concluirTarefa(supabase, body.id, { ator: g.ctx.userId || "humano", tenant_id: g.ctx.tenantId });
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
