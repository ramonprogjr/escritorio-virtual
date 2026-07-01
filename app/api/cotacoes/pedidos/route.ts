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

export async function GET(request: NextRequest) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;
  const supabase = db();
  if (!supabase) return NextResponse.json({ erro: "Serviço indisponível" }, { status: 503 });

  const { data, error } = await supabase
    .from("hub_cotacoes_pedidos")
    .select("id, titulo, descricao, status, criado_em, aprovacao_id")
    .eq("tenant_id", g.ctx.tenantId)
    .order("criado_em", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ pedidos: data || [] });
}

export async function POST(request: NextRequest) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;
  const supabase = db();
  if (!supabase) return NextResponse.json({ erro: "Serviço indisponível" }, { status: 503 });

  try {
    const body = await request.json();
    const titulo = typeof body.titulo === "string" ? body.titulo.trim() : "";
    const descricao = typeof body.descricao === "string" ? body.descricao.trim() : null;
    if (!titulo) {
      return NextResponse.json({ erro: "titulo é obrigatório" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("hub_cotacoes_pedidos")
      .insert({
        titulo,
        descricao,
        status: "rascunho",
        tenant_id: g.ctx.tenantId,
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
