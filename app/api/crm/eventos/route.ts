import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";

/** Feed de eventos da rede (hub_eventos) para o painel de gestão do Hub. Read-only. */
export async function GET(request: NextRequest) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const limite = Math.min(Number(request.nextUrl.searchParams.get("limite") ?? 30) || 30, 100);
  const { data, error } = await crmDb()
    .from("hub_eventos")
    .select("id, event_type, entity_type, fornecedor_id, lead_id, negocio_id, ator, payload, ts")
    .order("ts", { ascending: false })
    .limit(limite);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}
