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
  const atoParam = searchParams.get("ativo");
  const ativo = atoParam !== "false"; // default true
  const tipo = searchParams.get("tipo") || "";
  const finalidade = searchParams.get("finalidade") || "";
  const status = searchParams.get("status") || "";
  const offset = parseInt(searchParams.get("offset") || "0");
  const limit = 20;

  let query = supabase
    .from("hub_imoveis")
    .select(
      "id, codigo, titulo, tipo, finalidade, status, valor, cidade, estado, dormitorios, area_total_m2, ativo, criado_em",
      { count: "exact" }
    )
    .eq("ativo", ativo)
    .order("criado_em", { ascending: false })
    .range(offset, offset + limit - 1);

  if (tipo) query = query.eq("tipo", tipo);
  if (finalidade) query = query.eq("finalidade", finalidade);
  if (status) query = query.eq("status", status);
  if (busca) {
    query = query.or(
      `titulo.ilike.%${busca}%,cidade.ilike.%${busca}%,bairro.ilike.%${busca}%`
    );
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [], total: count ?? 0 });
}
