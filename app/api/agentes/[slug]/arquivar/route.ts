import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
  const body = await request.json() as { motivo?: string };

  if (!body.motivo || body.motivo.trim().length < 5) {
    return NextResponse.json(
      { erro: "Motivo obrigatório (mínimo 5 caracteres)." },
      { status: 400 }
    );
  }

  const supabase = db();

  const { error } = await supabase.rpc("hub_arquivar_agente", {
    p_agente_slug: slug,
    p_motivo: body.motivo.trim(),
  });

  if (error) {
    return NextResponse.json(
      { erro: error.message || "Falha ao arquivar agente." },
      { status: 400 }
    );
  }

  return NextResponse.json({ sucesso: true, mensagem: "Agente arquivado com sucesso." });
}
