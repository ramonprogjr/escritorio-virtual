import { NextRequest, NextResponse } from "next/server";
import { requireCrmComercial } from "@/lib/crm/crm-api-auth";
import { assinarConviteParceiro } from "@/lib/crm/parceiro-convite";

/**
 * Atribuição ASSINADA do convidador para montar o link de convite de parceiro:
 * `${origin}/parceiro/cadastro/rede?por=${por}&sig=${sig}`.
 *
 * O `por` (userId) vem da SESSÃO validada (não do cliente) e o `sig` é o HMAC do servidor —
 * o cadastro público só credita "quem convidou" se o sig confere. Espelha o convite do
 * especialista, mas com assinatura (o `?por` cru é forjável — H-SEC-3).
 */
export async function GET(request: NextRequest) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;
  const por = g.ctx.userId;
  return NextResponse.json({ por, sig: assinarConviteParceiro(por) });
}
