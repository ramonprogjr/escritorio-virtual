import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCrmGestor } from "@/lib/crm/crm-api-auth";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;
  const ctx = g.ctx;

  const { id } = await params;
  const body = await request.json();
  const { status, observacao } = body as {
    status: string;
    observacao?: string;
  };

  const supabase = db();
  // SEGURANÇA (F0/E6): a aprovação é SEMPRE do tenant da sessão. service_role bypassa RLS, então o
  // filtro de tenant no SELECT/UPDATE é a barreira contra aprovar a fila de outro (E6 leva dinheiro aqui).
  const { data: aprovacaoRow } = await supabase
    .from("hub_aprovacoes")
    .select("tipo, dados, obra_id")
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId)
    .single();
  if (!aprovacaoRow) {
    return NextResponse.json({ error: "Aprovação não encontrada" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {
    status,
    atualizado_em: new Date().toISOString(),
  };

  if (status === "aprovado") {
    updates.aprovado_por = ctx.userId;
    updates.aprovado_em = new Date().toISOString();
  } else if (status === "rejeitado" || status === "ignorado") {
    updates.rejeitado_por = ctx.userId;
    updates.rejeitado_em = new Date().toISOString();
    if (observacao) updates.observacao = observacao;
  }

  const { error } = await supabase
    .from("hub_aprovacoes")
    .update(updates)
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const dados = (aprovacaoRow?.dados as Record<string, unknown>) || {};
  const pedidoId = dados.pedido_id as string | undefined;
  if (aprovacaoRow?.tipo === "cotacao_fornecedor" && pedidoId && (status === "aprovado" || status === "rejeitado")) {
    await supabase
      .from("hub_cotacoes_pedidos")
      .update({
        status: status === "aprovado" ? "aprovado" : "rejeitado",
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", pedidoId);
  }

  // ── E6: cascata do gate dourado (só quando APROVADO; a IA nunca chega aqui — humano aprova o dinheiro) ──
  let escrow: Record<string, unknown> | undefined;
  if (status === "aprovado") {
    const tipo = aprovacaoRow.tipo as string;

    // GATE 1: orçamento da frente aprovado → libera os pagamentos vinculados.
    if (tipo === "orcamento_frente") {
      const orcId = dados.orcamento_id as string | undefined;
      if (orcId) {
        const { data: rpc } = await supabase.rpc("rpc_aprovar_orcamento_frente", {
          p_orcamento_id: orcId,
          p_aprovacao_id: id,
          p_tenant_id: ctx.tenantId,
        });
        escrow = { gate: "orcamento_frente", resultado: rpc };
      }
    }

    // GATE 2 (qualquer das 2 chaves aprovada): tenta liberar o escrow — só vai se AMBAS aprovadas.
    if (tipo === "pagamento_obra_arq" || tipo === "pagamento_obra_hub") {
      const pagamentoId = dados.pagamento_id as string | undefined;
      if (pagamentoId) {
        const { data: rpc } = await supabase.rpc("rpc_liberar_escrow", {
          p_pagamento_id: pagamentoId,
          p_tenant_id: ctx.tenantId,
        });
        escrow = { gate: "pagamento_obra", resultado: rpc };
      }
    }
  }

  return NextResponse.json({ ok: true, ...(escrow ? { escrow } : {}) });
}
