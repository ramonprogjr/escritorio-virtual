import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCrmComercial } from "@/lib/crm/crm-api-auth";

function db() {
  // fail-closed: sem fallback para a anon key (Batch 3 — cotações eram 100% públicas).
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Cria card em hub_aprovacoes para decisão humana (documento mestre: nada financeiro sem aprovação).
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;
  const supabase = db();
  if (!supabase) return NextResponse.json({ erro: "Serviço indisponível" }, { status: 503 });

  const { id: pedidoId } = await ctx.params;

  const { data: pedido, error: pe } = await supabase
    .from("hub_cotacoes_pedidos")
    .select("id, titulo, descricao, status, tenant_id")
    .eq("id", pedidoId)
    .eq("tenant_id", g.ctx.tenantId)
    .single();

  if (pe || !pedido) return NextResponse.json({ erro: "Pedido não encontrado" }, { status: 404 });
  if (pedido.status === "em_aprovacao" || pedido.status === "aprovado") {
    return NextResponse.json({ erro: "Pedido já enviado ou aprovado" }, { status: 409 });
  }

  const { data: respostas, error: re } = await supabase
    .from("hub_cotacoes_respostas")
    .select("*")
    .eq("pedido_id", pedidoId)
    .order("valor_total", { ascending: true });

  if (re) return NextResponse.json({ erro: re.message }, { status: 500 });
  if (!respostas?.length) {
    return NextResponse.json({ erro: "Inclua ao menos uma resposta de fornecedor antes de submeter" }, { status: 400 });
  }

  const melhor = respostas.reduce((a, b) => {
    const va = Number(a.valor_total) || Infinity;
    const vb = Number(b.valor_total) || Infinity;
    return va <= vb ? a : b;
  });

  const { data: aprovacao, error: ae } = await supabase
    .from("hub_aprovacoes")
    .insert({
      tenant_id: g.ctx.tenantId,
      tipo: "cotacao_fornecedor",
      agente_slug: "diretor_geral_ia",
      descricao: `Escolha de fornecedor — pedido: ${pedido.titulo}`,
      motivo: `Menor preço indicado: ${melhor.fornecedor_nome} (R$ ${melhor.valor_total ?? "—"}). Demais propostas no payload.`,
      impacto: "Contratação / compra — requer confirmação humana.",
      recomendacao: "Revisar prazos e condições antes de aprovar.",
      confianca_ia: 70,
      valor_envolvido: melhor.valor_total != null ? Number(melhor.valor_total) : 0,
      dados: {
        pedido_id: pedidoId,
        respostas,
        sugerido: melhor,
      },
      status: "pendente",
    })
    .select("id")
    .single();

  if (ae || !aprovacao) {
    return NextResponse.json({ erro: ae?.message || "Erro ao criar aprovação" }, { status: 500 });
  }

  await supabase
    .from("hub_cotacoes_pedidos")
    .update({
      status: "em_aprovacao",
      aprovacao_id: aprovacao.id,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", pedidoId);

  return NextResponse.json({ ok: true, aprovacao_id: aprovacao.id });
}
