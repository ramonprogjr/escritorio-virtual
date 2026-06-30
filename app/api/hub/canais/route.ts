import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { sanitizarAgenteHubParaCliente } from "@/lib/hub/sanitize-agente-hub-public";
import { selectHubAgenteWithColumnFallback } from "@/lib/hub/hub-agente-column-compat";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { tenantScopeOrFilter, isMissingPgColumn } from "@/lib/tenant-default";

const CANAIS_SELECT =
  "agente_slug, nome, ativo, arquivado_em, uazapi_instance_id, uazapi_instance_name, uazapi_connection_status, uazapi_instance_token, modo_operacao, uazapi_snapshot_at";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** Lista canais WhatsApp — só leitura do banco, sem chamadas WhatsApp. */
export async function GET(request: NextRequest) {
  // Guard de sessão: a lista de canais/instâncias não pode vazar para chamador anónimo.
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const supabase = db();
  const tenantFilter = tenantScopeOrFilter(g.ctx.tenantId);

  let { data, error } = await selectHubAgenteWithColumnFallback(
    async (cols) =>
      await supabase.from("hub_agente_identidade").select(cols).or(tenantFilter),
    CANAIS_SELECT
  );

  // Base sem coluna tenant_id (migração 20260522 ainda não aplicada): degrada para
  // leitura sem filtro de tenant — o guard de sessão acima continua fechando o acesso.
  if (error && isMissingPgColumn(error, "tenant_id")) {
    ({ data, error } = await selectHubAgenteWithColumnFallback(
      async (cols) => await supabase.from("hub_agente_identidade").select(cols),
      CANAIS_SELECT
    ));
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (Array.isArray(data) ? data : []) as unknown as Record<string, unknown>[];
  return NextResponse.json(rows.map(sanitizarAgenteHubParaCliente));
}
