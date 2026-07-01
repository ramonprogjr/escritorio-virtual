import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCrmComercial } from "@/lib/crm/crm-api-auth";

// FLAG PRO DONO: esta rota é chamada hoje por app/fornecedor/cotacao/page.tsx (marcada
// como "protótipo" na própria UI). Não existe mecanismo de identidade de fornecedor
// externo real para cotações (diferente do portal de parceiros, que usa link HMAC
// assinado — ver lib/parceiro-portal.ts + app/api/parceiros/portal/verify). Enquanto
// essa decisão de design não for tomada, a rota exige sessão CRM (como as demais de
// /api/cotacoes) — ou seja, o "fornecedor" preenchendo a proposta precisa ser um
// operador logado no CRM digitando em nome do fornecedor. Se o objetivo é o PRÓPRIO
// fornecedor (sem conta) preencher a proposta, é preciso desenhar um token assinado
// por pedido/fornecedor (mesmo padrão HMAC do portal de parceiros) antes de reabrir.
function db() {
  // fail-closed: sem fallback para a anon key (Batch 3 — cotações eram 100% públicas).
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;
  const supabase = db();
  if (!supabase) return NextResponse.json({ erro: "Serviço indisponível" }, { status: 503 });

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

  const { data: pedido, error: pe } = await supabase
    .from("hub_cotacoes_pedidos")
    .select("id, status")
    .eq("id", pedidoId)
    .eq("tenant_id", g.ctx.tenantId)
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
