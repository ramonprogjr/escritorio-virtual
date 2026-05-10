import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: pedidoId } = await ctx.params;
  let body: {
    fornecedor_nome?: string;
    valor_total?: number;
    prazo_dias?: number;
    observacoes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }

  const nome = typeof body.fornecedor_nome === "string" ? body.fornecedor_nome.trim() : "";
  if (!nome) return NextResponse.json({ erro: "fornecedor_nome é obrigatório" }, { status: 400 });

  const supabase = db();
  const { data: pedido, error: pe } = await supabase
    .from("hub_cotacoes_pedidos")
    .select("id, status")
    .eq("id", pedidoId)
    .single();

  if (pe || !pedido) return NextResponse.json({ erro: "Pedido não encontrado" }, { status: 404 });
  if (["em_aprovacao", "aprovado", "rejeitado", "cancelado"].includes(pedido.status)) {
    return NextResponse.json({ erro: "Pedido não aceita novas respostas neste status" }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("hub_cotacoes_respostas")
    .insert({
      pedido_id: pedidoId,
      fornecedor_nome: nome,
      valor_total: body.valor_total ?? null,
      prazo_dias: body.prazo_dias ?? null,
      observacoes: body.observacoes ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ erro: error?.message || "Erro ao salvar resposta" }, { status: 500 });
  }

  await supabase
    .from("hub_cotacoes_pedidos")
    .update({ status: "cotando", atualizado_em: new Date().toISOString() })
    .eq("id", pedidoId);

  return NextResponse.json({ resposta: data }, { status: 201 });
}
