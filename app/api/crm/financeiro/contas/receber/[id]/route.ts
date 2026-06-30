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
  // D-10: grava baixado_por/baixado_em para trilha de auditoria (nullable; tolerante se a
  // coluna ainda não existir — migração 20260631130000 adiciona as colunas).
  const tenantId = auth.ctx.tenantId;
  const agora = new Date().toISOString();
  const supabase = db();

  const buildPayload = (comAuditoria: boolean) => ({
    status,
    atualizado_em: agora,
    ...(comAuditoria && status === "recebido"
      ? { baixado_por: auth.ctx.userId ?? "desconhecido", baixado_em: agora }
      : {}),
  });

  const runUpdate = (withTenantFilter: boolean, withAuditoria: boolean) => {
    let query = supabase
      .from("hub_contas_receber")
      .update(buildPayload(withAuditoria))
      .eq("id", id);
    if (withTenantFilter) query = query.or(tenantScopeOrFilter(tenantId));
    return query;
  };

  let { error } = await runUpdate(true, true);
  // Fallback 1: coluna baixado_por ainda não existe no banco → tenta sem auditoria
  if (error && isMissingPgColumn(error, "baixado_por")) {
    ({ error } = await runUpdate(true, false));
  }
  // Fallback 2: coluna tenant_id ainda não existe → tenta sem filtro de tenant
  if (error && isMissingPgColumn(error, "tenant_id")) {
    ({ error } = await runUpdate(false, false));
  }

  if (error) {
    console.error("[financeiro/contas/receber PATCH] erro ao atualizar:", error.message);
    return NextResponse.json(
      { error: "Não foi possível atualizar o lançamento. Tente novamente." },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
