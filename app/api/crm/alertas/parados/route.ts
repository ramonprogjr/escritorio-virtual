import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { defaultTenantId, tenantIdFromRequest } from "@/lib/tenant-default";

/**
 * rf-alerta-parado — leads "parados" (precisam de ação): não terminados e SEM
 * `proxima_acao` definida. Read-only. Ordena do mais antigo (mais parado) ao mais novo.
 * Espelha o filtro de etapa terminal usado em /api/crm/leads.
 */
const SELECT =
  "id, codigo, nome, telefone, estagio, valor_estimado, proxima_acao, atualizado_em, criado_em";

const ETAPAS_TERMINAIS = "(ganho,perdido,convertido_negocio)";

export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") || "50", 10), 100);

  const { data, error } = await crmDb()
    .from("hub_leads_crm")
    .select(SELECT)
    .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
    .not("estagio", "in", ETAPAS_TERMINAIS)
    .is("proxima_acao", null)
    .order("atualizado_em", { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const agora = Date.now();
  const rows = (data ?? []).map((l) => {
    const ref = l.atualizado_em || l.criado_em;
    const diasParado = ref
      ? Math.max(0, Math.floor((agora - new Date(String(ref)).getTime()) / 86_400_000))
      : null;
    return {
      id: l.id,
      codigo: l.codigo,
      nome: l.nome,
      telefone: l.telefone,
      estagio: l.estagio,
      valor_estimado: l.valor_estimado,
      dias_parado: diasParado,
    };
  });

  return NextResponse.json({ data: rows, total: rows.length });
}
