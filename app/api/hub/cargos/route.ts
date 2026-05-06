import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  const supabase = db();

  const { data, error } = await supabase
    .from("hub_cargos_catalogo")
    .select("*")
    .eq("ativo", true)
    .order("segmento")
    .order("especialidade")
    .order("nivel");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
