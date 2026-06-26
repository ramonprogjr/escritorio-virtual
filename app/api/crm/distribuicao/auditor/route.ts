import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { requireCrmGestor } from "@/lib/crm/crm-api-auth";
import { cronRequestAuthorized } from "@/lib/cron-auth";
import { rodarAuditorRede } from "@/lib/crm/auditor-autonomo";

const DEFAULT_TENANT = "00000000-0000-4000-8000-000000000001";

/**
 * Auditor autônomo da rede (C.1c). Aceita DOIS chamadores:
 *  - **Cron** (Bearer CRON_SECRET): roda agendado (ex.: Render/Vercel cron a cada 30–60 min)
 *    no tenant default. Multi-tenant: varrer tenants é incremento futuro.
 *  - **Gestor logado** (botão "Rodar auditor agora"): roda no tenant do caller, sob demanda.
 * Emite cobranças automáticas idempotentes (cooldown 12h) → feed + sino.
 */
export async function POST(request: NextRequest) {
  let tenantId: string;
  if (cronRequestAuthorized(request)) {
    tenantId = DEFAULT_TENANT;
  } else {
    const g = await requireCrmGestor(request);
    if ("error" in g) return g.error;
    tenantId = g.ctx.tenantId;
  }

  const result = await rodarAuditorRede(crmDb(), tenantId, Date.now());
  return NextResponse.json({ ok: true, ...result });
}

export const GET = POST;
