import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { defaultTenantId } from "@/lib/tenant-default";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET() {
  const supabase = db();
  const { data, error } = await supabase
    .from("hub_cotacoes_pedidos")
    .select("id, titulo, descricao, status, criado_em, aprovacao_id")
    .order("criado_em", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ pedidos: data || [] });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const titulo = typeof body.titulo === "string" ? body.titulo.trim() : "";
    const descricao = typeof body.descricao === "string" ? body.descricao.trim() : null;
    if (!titulo) {
      return NextResponse.json({ erro: "titulo é obrigatório" }, { status: 400 });
    }

    const supabase = db();
    const { data, error } = await supabase
      .from("hub_cotacoes_pedidos")
      .insert({
        titulo,
        descricao,
        status: "rascunho",
        tenant_id: defaultTenantId(),
      })
      .select("id, titulo, descricao, status, criado_em")
      .single();

    if (error || !data) {
      return NextResponse.json({ erro: error?.message || "Erro ao criar pedido" }, { status: 500 });
    }
    return NextResponse.json({ pedido: data }, { status: 201 });
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }
}
