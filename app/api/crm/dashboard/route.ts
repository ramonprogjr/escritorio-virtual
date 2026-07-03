import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { aggregateDashboard } from "@/lib/crm/dashboard-aggregate";
import { getCallerContext } from "@/lib/crm/crm-api-auth";
import { personaCockpitFromRole } from "@/lib/crm/persona-cockpit";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  // Persona-aware: usamos getCallerContext (não requireCrmSessao) porque os papéis do ECOSSISTEMA
  // (operation/architect/client/supplier/commercial, em inglês) NÃO têm nível no RBAC interno
  // (crmNivelFromRole=null) e seriam REJEITADOS com 403 por requireCrmSessao. getCallerContext só
  // exige sessão VÁLIDA + conta ativa (mesmo tenant), e nos dá o role cru p/ montar o recorte.
  // Tenant SEMPRE da sessão (cookie httpOnly), nunca do header x-tenant-id (forjável).
  const g = await getCallerContext(request);
  if ("error" in g) return g.error;

  const sinceParam = request.nextUrl.searchParams.get("since");
  const since =
    sinceParam ||
    new Date(
      Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())
    ).toISOString();
  const tenantId = g.ctx.tenantId;
  const persona = personaCockpitFromRole(g.ctx.role);
  try {
    // userId (não auth_id) só é usado p/ escopar a obra do cliente; tenant/persona vêm da sessão.
    const payload = await aggregateDashboard(db(), tenantId, since, persona, {
      userId: g.ctx.userId,
    });
    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao agregar painel CRM";
    console.error("[api/crm/dashboard]", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
