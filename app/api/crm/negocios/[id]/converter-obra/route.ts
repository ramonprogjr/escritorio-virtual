import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmComercial } from "@/lib/crm/crm-api-auth";
import { derivarEntregaDoNegocio } from "@/lib/crm/derivar-entrega";

type Params = { params: Promise<{ id: string }> };

/**
 * Geração MANUAL da entrega (botão "Gerar obra/projeto"). Mesma lógica do gatilho automático
 * ao fechar — ambos chamam derivarEntregaDoNegocio (idempotente, não duplica).
 * Override via body.tipo_alvo ('obra' | 'projeto').
 */
export async function POST(request: NextRequest, { params }: Params) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const override = typeof body.tipo_alvo === "string" ? body.tipo_alvo : null;

  const result = await derivarEntregaDoNegocio(crmDb(), id, {
    override,
    tenant_id: g.ctx.tenantId,
    origem: "manual",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(
    { data: result.data, tipo: result.tipo, ja_existia: result.ja_existia },
    { status: result.ja_existia ? 200 : 201 }
  );
}
