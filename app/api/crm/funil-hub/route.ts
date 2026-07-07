import { NextRequest, NextResponse } from "next/server";
import { crmDb as db } from "@/lib/crm/supabase-server";
import { requireCrmComercial } from "@/lib/crm/crm-api-auth";
import type {
  FunilLeadRow,
  FunilVinculoRow,
  FunilNegocioRow,
  FunilObraRow,
} from "@/lib/crm/funil-do-hub";

/**
 * Dados brutos do Funil do Hub (within-tenant), lidos com service_role para não depender
 * da RLS do browser. O componente fatia por mercado/origem no cliente (filtro instantâneo).
 */
export async function GET(request: NextRequest) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;
  const t = g.ctx.tenantId;

  const [leads, vinculos, negocios, obras] = await Promise.all([
    db().from("hub_leads_crm").select("id, estagio, valor_estimado, origem, metadata").eq("tenant_id", t),
    db().from("hub_negocio_vinculos").select("negocio_id, entidade_id").eq("papel", "lead_origem").eq("tenant_id", t),
    db().from("hub_negocios").select("id, status, valor_estimado").eq("tenant_id", t),
    db().from("hub_obras").select("negocio_id, status").eq("tenant_id", t),
  ]);

  return NextResponse.json({
    data: {
      leads: (leads.data ?? []) as FunilLeadRow[],
      vinculos: (vinculos.data ?? []) as FunilVinculoRow[],
      negocios: (negocios.data ?? []) as FunilNegocioRow[],
      obras: (obras.data ?? []) as FunilObraRow[],
    },
  });
}
