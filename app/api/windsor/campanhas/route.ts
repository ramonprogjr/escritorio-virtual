import { NextRequest, NextResponse } from "next/server";
import { requireCrmGestor } from "@/lib/crm/crm-api-auth";

/** Mapeia o filtro de período (7d/14d/30d) para nº de dias. Default seguro: 7. */
const DIAS_POR_PERIODO: Record<string, number> = { "7d": 7, "14d": 14, "30d": 30 };

export async function GET(request: NextRequest) {
  // Conta Windsor é única/global (1 WINDSOR_API_KEY p/ toda a rede) — sem isolamento
  // por tenant ainda. Gate por gestor/owner enquanto o modelo de credencial-por-tenant
  // não existe (ver PRECISA-DONO no relatório de auditoria). Mínimo: exige login + papel.
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  const apiKey = process.env.WINDSOR_API_KEY;
  if (!apiKey) return NextResponse.json([]);

  const periodo = request.nextUrl.searchParams.get("periodo") ?? "7d";
  const dias = DIAS_POR_PERIODO[periodo] ?? 7;

  try {
    const hoje = new Date();
    const inicio = new Date(hoje.getTime() - dias * 24 * 3600000);
    const dateFrom = inicio.toISOString().split("T")[0];
    const dateTo = hoje.toISOString().split("T")[0];

    const res = await fetch(
      `https://connectors.windsor.ai/facebook?api_key=${apiKey}&date_from=${dateFrom}&date_to=${dateTo}&fields=campaign,spend,clicks,impressions,cpc,ctr,conversions`,
      { next: { revalidate: 21600 } }
    );
    if (!res.ok) return NextResponse.json([]);
    const data = await res.json();
    return NextResponse.json(data?.data || []);
  } catch {
    return NextResponse.json([]);
  }
}
