import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = db();

  const { data, error } = await supabase
    .from("hub_agente_identidade")
    .select("*")
    .eq("agente_slug", slug)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Agente não encontrado." }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(
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

  // Campos editáveis — ignorar silenciosamente cargo, area, nivel, modelo_padrao
  const camposEditaveis = [
    "nome",
    "personalidade",
    "prefixo_mercado",
    "bio",
    "tom_voz",
    "estilo_comunicacao",
    "horario_inicio",
    "horario_fim",
    "dias_semana",
    "system_prompt_base",
  ];

  const payload: Record<string, unknown> = {};
  for (const campo of camposEditaveis) {
    if (campo in body) {
      payload[campo] = body[campo];
    }
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json(
      { error: "Nenhum campo editável fornecido." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("hub_agente_identidade")
    .update(payload)
    .eq("agente_slug", slug)
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Agente não encontrado." }, { status: 404 });
  }

  return NextResponse.json(data);
}
