import { createClient } from "@supabase/supabase-js";

import { NextRequest, NextResponse } from "next/server";

import { fetchCrmMetricas } from "@/lib/crm/dashboard-aggregate";

import { requireCrmSessao } from "@/lib/crm/crm-api-auth";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  // Tenant SEMPRE da sessão (cookie httpOnly), nunca do header x-tenant-id (forjável).
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const sinceParam = request.nextUrl.searchParams.get("since");
  const since =
    sinceParam ||
    new Date(
      Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())
    ).toISOString();

  const metricas = await fetchCrmMetricas(db(), g.ctx.tenantId, since);

  return NextResponse.json(metricas);
}
