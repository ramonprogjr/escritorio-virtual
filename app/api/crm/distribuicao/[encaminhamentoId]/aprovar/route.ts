import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { requireCrmComercial } from "@/lib/crm/crm-api-auth";
import { aprovarEEnviarEncaminhamento } from "@/lib/crm/notificar-parceiro-lead";

type Params = { params: Promise<{ encaminhamentoId: string }> };

/**
 * Aprova um encaminhamento sugerido e envia o lead ao fornecedor escolhido.
 * `parceiro_id` (opcional) permite escolher QUAL dos 5 candidatos receber — se omitido,
 * usa o principal gravado no encaminhamento. Entregas #2 e #3 do dono.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const { encaminhamentoId } = await params;
  const body = (await request.json().catch(() => ({}))) as { parceiro_id?: string };
  const parceiroId = typeof body.parceiro_id === "string" ? body.parceiro_id.trim() : undefined;

  const result = await aprovarEEnviarEncaminhamento(crmDb(), encaminhamentoId, {
    parceiro_id: parceiroId || undefined,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, telefone: result.telefone });
}
