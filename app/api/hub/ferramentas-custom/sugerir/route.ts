import { NextRequest, NextResponse } from "next/server";
import { sugerirFerramentaCustomComMistral } from "@/lib/hub/sugerir-ferramenta-custom";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const titulo = String(body.titulo || "").trim();
  if (!titulo) return NextResponse.json({ error: "titulo é obrigatório." }, { status: 400 });

  const out = await sugerirFerramentaCustomComMistral({ tituloPedido: titulo });
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: 502 });

  return NextResponse.json({ sugestao: out.sugestao });
}
