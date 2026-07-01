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

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;
  const supabase = db();
  if (!supabase) return NextResponse.json({ erro: "Serviço indisponível" }, { status: 503 });

  const { id } = await ctx.params;
  const { data: pedido, error: e1 } = await supabase
    .from("hub_cotacoes_pedidos")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", g.ctx.tenantId)
    .single();

  if (e1 || !pedido) {
    return NextResponse.json({ erro: "Pedido não encontrado" }, { status: 404 });
  }

  const { data: respostas, error: e2 } = await supabase
    .from("hub_cotacoes_respostas")
    .select("*")
    .eq("pedido_id", id)
    .order("criado_em", { ascending: true });

  if (e2) return NextResponse.json({ erro: e2.message }, { status: 500 });
  return NextResponse.json({ pedido, respostas: respostas || [] });
}
