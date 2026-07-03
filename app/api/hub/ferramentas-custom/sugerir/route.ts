import { NextRequest, NextResponse } from "next/server";
import { sugerirFerramentaCustomComMistral } from "@/lib/hub/sugerir-ferramenta-custom";
import { requireCrmGestor } from "@/lib/crm/crm-api-auth";
import { requireIaRateLimit } from "@/lib/ia/rate-limit-ia";

export async function POST(request: NextRequest) {
  // E-B8: guard de gestor — sugestão chama LLM (custo de inferência).
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  // Teto anti-abuso por tenant (LLM pago).
  const limite = requireIaRateLimit(`ferramentas-sugerir:${g.ctx.tenantId}`, 20);
  if (limite) return limite;

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
