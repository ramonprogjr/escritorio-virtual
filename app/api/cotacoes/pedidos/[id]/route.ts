import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = db();
  const { data: pedido, error: e1 } = await supabase
    .from("hub_cotacoes_pedidos")
    .select("*")
    .eq("id", id)
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
