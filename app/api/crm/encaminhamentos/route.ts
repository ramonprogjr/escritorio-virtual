import { crmDb as db } from "@/lib/crm/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { registrarLogCrm } from "@/lib/crm/audit-log";
import { crmFeatureFlags } from "@/lib/crm/feature-flags";
import { requireCrmComercial } from "@/lib/crm/crm-api-auth";
import { criarEncaminhamentoPendente } from "@/lib/crm/encaminhamento-criar";

const STATUS_VALIDOS = [
  "sugerido_ia",
  "aguardando_validacao",
  "aprovado_envio",
  "enviado",
  "recebido",
  "aceito",
  "recusado",
  "sem_resposta",
  "em_atendimento",
  "convertido_negocio",
  "perdido",
  "bloqueado",
] as const;

export async function GET(request: NextRequest) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const lead_id = new URL(request.url).searchParams.get("lead_id");
  if (!lead_id) return NextResponse.json({ error: "lead_id obrigatório" }, { status: 400 });

  const { data, error } = await db()
    .from("hub_encaminhamentos")
    .select("*")
    .eq("lead_id", lead_id)
    .eq("tenant_id", g.ctx.tenantId)
    .order("criado_em", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  if (!crmFeatureFlags.encaminhamentoV2()) {
    return NextResponse.json(
      { error: "Encaminhamento V2 desativado. Defina CRM_ENCAMINHAMENTO_V2=true." },
      { status: 403 }
    );
  }

  const body = (await request.json()) as Record<string, unknown>;
  const lead_id = body.lead_id as string | undefined;
  if (!lead_id) return NextResponse.json({ error: "lead_id obrigatório" }, { status: 400 });

  const status = (body.status as string) || "aguardando_validacao";
  if (!STATUS_VALIDOS.includes(status as (typeof STATUS_VALIDOS)[number])) {
    return NextResponse.json({ error: "status inválido" }, { status: 400 });
  }

  // Create + guard de posse (IDOR) extraídos p/ lib compartilhada (reusada pela tool de voz).
  const r = await criarEncaminhamentoPendente(db(), g.ctx.tenantId, {
    lead_id,
    negocio_id: (body.negocio_id as string) || null,
    destinatario_pessoa_id: (body.destinatario_pessoa_id as string) || null,
    destinatario_empresa_id: (body.destinatario_empresa_id as string) || null,
    segmento: (body.segmento as string) || null,
    responsavel_envio: (body.responsavel_envio as string) || null,
    sugerido_ia: Boolean(body.sugerido_ia),
    validado_humano: Boolean(body.validado_humano),
    status,
    criterio_selecao: (body.criterio_selecao as string) || null,
    encaminhado_em: typeof body.encaminhado_em === "string" ? body.encaminhado_em : undefined,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r.data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const body = (await request.json()) as Record<string, unknown>;
  const id = body.id as string | undefined;
  const status = body.status as string | undefined;
  if (!id || !status) {
    return NextResponse.json({ error: "id e status obrigatórios" }, { status: 400 });
  }

  const supabase = db();

  const { data: prev, error: prevErr } = await supabase
    .from("hub_encaminhamentos")
    .select("status, lead_id, tenant_id")
    .eq("id", id)
    .maybeSingle();
  if (prevErr) return NextResponse.json({ error: prevErr.message }, { status: 500 });
  if (!prev || (prev.tenant_id && prev.tenant_id !== g.ctx.tenantId)) {
    return NextResponse.json({ error: "Encaminhamento não encontrado." }, { status: 404 });
  }

  const updates: Record<string, unknown> = {
    status,
    atualizado_em: new Date().toISOString(),
  };
  if (status === "enviado") updates.enviado_em = new Date().toISOString();
  if (status === "aceito" || status === "recusado") {
    updates.respondido_em = new Date().toISOString();
    updates.resposta_destinatario = (body.resposta_destinatario as string) || null;
  }
  if (body.validado_humano === true) updates.validado_humano = true;

  const { error } = await supabase.from("hub_encaminhamentos").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await registrarLogCrm(supabase, {
    entidade: "encaminhamento",
    entidade_id: id,
    acao: "status_alterado",
    valor_anterior: prev?.status ?? null,
    valor_novo: status,
  });

  return NextResponse.json({ ok: true });
}
