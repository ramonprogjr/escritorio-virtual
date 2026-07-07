import { NextRequest, NextResponse } from "next/server";
import { crmDb as db } from "@/lib/crm/supabase-server";
import { requireCrmComercial } from "@/lib/crm/crm-api-auth";
import type { OpNegocioRow, OpObraRow, OpPedidoRow } from "@/lib/crm/operacao-excecao";

/** Dados brutos de "O que travou" (within-tenant, service_role). O componente computa a exceção. */
export async function GET(request: NextRequest) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;
  const t = g.ctx.tenantId;

  const [negocios, obras, pedidos] = await Promise.all([
    db().from("hub_negocios").select("status, atualizado_em, valor_estimado, proxima_acao").eq("tenant_id", t),
    db().from("hub_obras").select("status, data_previsao_fim").eq("tenant_id", t),
    db().from("hub_pedidos_material").select("status, atualizado_em").eq("tenant_id", t),
  ]);

  return NextResponse.json({
    data: {
      negocios: (negocios.data ?? []) as OpNegocioRow[],
      obras: (obras.data ?? []) as OpObraRow[],
      pedidos: (pedidos.data ?? []) as OpPedidoRow[],
    },
  });
}
