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
  const tipo_pessoa = searchParams.get("tipo_pessoa") || "";
  const offset = parseInt(searchParams.get("offset") || "0");
  const limit = 20;

  let query = supabase
    .from("hub_pessoas")
    .select(
      "id, codigo, nome, telefone, email, tipo, tipo_pessoa, empresa, cidade, estado, criado_em",
      { count: "exact" }
    )
    .order("criado_em", { ascending: false })
    .range(offset, offset + limit - 1);

  if (busca) {
    query = query.or(
      `nome.ilike.%${busca}%,email.ilike.%${busca}%,telefone.ilike.%${busca}%`
    );
  }
  if (tipo_pessoa) {
    query = query.eq("tipo_pessoa", tipo_pessoa);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [], total: count ?? 0 });
}
