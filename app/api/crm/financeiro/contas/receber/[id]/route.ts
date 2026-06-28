import { requireCrmFinanceiro } from "@/lib/crm/crm-api-auth";
import { isMissingPgColumn, tenantScopeOrFilter } from "@/lib/tenant-default";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireCrmFinanceiro(request);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { status?: string };
  const status = body.status?.trim();
  if (!status || !["pendente", "recebido", "cancelado"].includes(status)) {
    return NextResponse.json({ error: "status inválido" }, { status: 400 });
  }

  // Update com escopo de tenant (id + tenant atual / legado / NULL). Sem isto, o service-role
  // bypassa RLS e um financeiro de um tenant flipava o status de recebíveis de outro tenant.
  // Fallback sem o filtro `.or` se a coluna tenant_id ainda não existir nesta base.
  const tenantId = auth.ctx.tenantId;
  const supabase = db();
  const runUpdate = (withTenantFilter: boolean) => {
    let query = supabase
      .from("hub_contas_receber")
      .update({ status, atualizado_em: new Date().toISOString() })
      .eq("id", id);
    if (withTenantFilter) query = query.or(tenantScopeOrFilter(tenantId));
    return query;
  };

  let { error } = await runUpdate(true);
  if (error && isMissingPgColumn(error, "tenant_id")) {
    ({ error } = await runUpdate(false));
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
