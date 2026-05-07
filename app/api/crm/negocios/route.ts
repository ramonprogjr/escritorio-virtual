import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  const supabase = db();
  const { searchParams } = new URL(request.url);
  const busca = searchParams.get("busca") || "";
  const status = searchParams.get("status") || "";
  const etapa = searchParams.get("etapa") || "";
  const prefixo = searchParams.get("prefixo_mercado") || "";
  const offset = parseInt(searchParams.get("offset") || "0");
  const limit = 20;

  let query = supabase
    .from("hub_negocios")
    .select(
      "id, codigo, titulo, prefixo_mercado, status, etapa, valor_estimado, valor_fechado, data_previsao_fechamento, criado_em",
      { count: "exact" }
    )
    .order("criado_em", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);
  if (etapa) query = query.eq("etapa", etapa);
  if (prefixo) query = query.eq("prefixo_mercado", prefixo);
  if (busca) {
    query = query.or(`titulo.ilike.%${busca}%,codigo.ilike.%${busca}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [], total: count ?? 0 });
}
