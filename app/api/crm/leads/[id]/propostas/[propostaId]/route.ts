import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { transicaoValida, propostaStatusLabel } from "@/lib/crm/proposta-status";

type Params = { params: Promise<{ id: string; propostaId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  // Guard (middleware é morto → cada rota se protege). Estava SEM guard nem filtro de
  // tenant — o "irmão" (.../propostas/route.ts, coleção) já tinha sido corrigido no
  // H-SEC-1; este endpoint de item individual (PATCH/DELETE por id) ficou aberto.
  const sessao = await requireCrmSessao(request);
  if ("error" in sessao) return sessao.error;

  const { id: lead_id, propostaId } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const allowed = ["titulo", "valor", "escopo", "prazo_dias", "validade_dias", "servico_id", "status", "motivo_recusa"] as const;
  const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  const supabase = crmDb();

  // Guard de posse: a proposta precisa pertencer ao tenant do caller.
  const { data: existente, error: fetchErr } = await supabase
    .from("hub_propostas")
    .select("id, tenant_id, status")
    .eq("id", propostaId)
    .eq("lead_id", lead_id)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!existente) return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });
  const tid = existente.tenant_id != null ? String(existente.tenant_id).trim() : "";
  if (tid && tid !== sessao.ctx.tenantId) {
    return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });
  }

  // Ciclo de vida: valida a transição e CARIMBA os tempos (o sistema mostra o que fez).
  const statusNovo = typeof body.status === "string" ? body.status.toLowerCase() : null;
  const statusAntigo = String(existente.status ?? "rascunho").toLowerCase();
  const agora = new Date().toISOString();
  if (statusNovo && statusNovo !== statusAntigo) {
    if (!transicaoValida(statusAntigo, statusNovo)) {
      return NextResponse.json({ error: `Transição inválida: ${propostaStatusLabel(statusAntigo)} → ${propostaStatusLabel(statusNovo)}.` }, { status: 409 });
    }
    if (statusNovo === "recusada" && !String(body.motivo_recusa ?? "").trim()) {
      return NextResponse.json({ error: "Informe o motivo da recusa." }, { status: 400 });
    }
    patch.status = statusNovo;
    if (statusNovo === "enviada") patch.enviada_em = agora;
    if (statusNovo === "aprovada") { patch.aprovado_em = agora; patch.aprovado_por = sessao.ctx.userId ?? "gestor"; }
    if (statusNovo === "aceita" || statusNovo === "recusada") patch.respondida_em = agora;
  }

  const { data, error } = await supabase
    .from("hub_propostas")
    .update(patch)
    .eq("id", propostaId)
    .eq("lead_id", lead_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Trilha na Conversa do lead (nada se perde) — só quando o status mudou.
  if (statusNovo && statusNovo !== statusAntigo) {
    await supabase.from("hub_atividades").insert({
      lead_id,
      tipo: "proposta",
      descricao: `Proposta ${propostaStatusLabel(statusNovo).toLowerCase()}: ${String(data.titulo ?? "").slice(0, 80)}`,
      feito_por: "humano",
      feito_por_tipo: "humano",
      tenant_id: sessao.ctx.tenantId,
    });
  }

  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  // Guard (middleware é morto → cada rota se protege). Mesma lacuna do PATCH acima.
  const sessao = await requireCrmSessao(request);
  if ("error" in sessao) return sessao.error;

  const { id: lead_id, propostaId } = await params;
  const supabase = crmDb();

  const { data: existente, error: fetchErr } = await supabase
    .from("hub_propostas")
    .select("id, tenant_id")
    .eq("id", propostaId)
    .eq("lead_id", lead_id)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!existente) return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });
  const tid = existente.tenant_id != null ? String(existente.tenant_id).trim() : "";
  if (tid && tid !== sessao.ctx.tenantId) {
    return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });
  }

  const { error } = await supabase.from("hub_propostas").delete().eq("id", propostaId).eq("lead_id", lead_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
