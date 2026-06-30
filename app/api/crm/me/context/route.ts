import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import {
  crmApiConfigError,
  getCallerContext,
} from "@/lib/crm/crm-api-auth";
import { fetchTenantNomeExibicao } from "@/lib/crm/users-equipa";

/** Contexto de sessão CRM: tenant e papel do utilizador autenticado. */
export async function GET(request: NextRequest) {
  const config = crmApiConfigError();
  if (config) return config;

  const caller = await getCallerContext(request);
  if ("error" in caller) return caller.error;

  const supabase = crmDb();
  const tenantNome = await fetchTenantNomeExibicao(supabase, caller.ctx.tenantId);

  return NextResponse.json({
    role: caller.ctx.role,
    tenantId: caller.ctx.tenantId,
    tenantNome: tenantNome ?? "Obra10+",
  });
}
