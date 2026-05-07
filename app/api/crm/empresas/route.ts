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
  const offset = parseInt(searchParams.get("offset") || "0");
  const limit = 20;

  let query = supabase
    .from("hub_empresas")
    .select(
      "id, codigo, razao_social, nome_fantasia, cnpj, email, telefone, cidade, estado, segmento, prefixo_mercado, ativo, criado_em",
      { count: "exact" }
    )
    .eq("ativo", ativo)
    .order("criado_em", { ascending: false })
    .range(offset, offset + limit - 1);

  if (busca) {
    query = query.or(
      `razao_social.ilike.%${busca}%,nome_fantasia.ilike.%${busca}%,cnpj.ilike.%${busca}%,email.ilike.%${busca}%`
    );
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [], total: count ?? 0 });
}
