import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = db();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const { motivo } = body as { motivo?: string };

  if (!motivo || typeof motivo !== "string" || motivo.trim().length < 10) {
    return NextResponse.json(
      { error: "O campo motivo é obrigatório e deve ter no mínimo 10 caracteres." },
      { status: 400 }
    );
  }

  const { error } = await supabase.rpc("hub_arquivar_agente", {
    p_agente_slug: slug,
    p_motivo: motivo.trim(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ sucesso: true }, { status: 200 });
}
