import { NextRequest, NextResponse } from "next/server";
import { requireCrmComercial } from "@/lib/crm/crm-api-auth";

/**
 * Devolve o identificador do convidador (userId da sessão) para montar o link de convite
 * de especialista. O cliente compõe `${origin}/especialista/cadastro?por=${por}`.
 * userId vem da sessão (não falsificável) — garante o rastreio "mão de obra de quem".
 */
export async function GET(request: NextRequest) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;
  return NextResponse.json({ por: g.ctx.userId });
}
