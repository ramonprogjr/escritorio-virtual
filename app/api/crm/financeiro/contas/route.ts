import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmFinanceiro } from "@/lib/crm/crm-api-auth";
import { isMissingPgColumn, tenantIdFromRequest, tenantScopeOrFilter } from "@/lib/tenant-default";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const auth = await requireCrmFinanceiro(request);
  if ("error" in auth) return auth.error;

  const body = (await request.json().catch(() => ({}))) as {
    tipo?: string;
    descricao?: string;
    valor?: number | string;
    vencimento?: string | null;
    negocio_id?: string | null;
  };

  const tipo = body.tipo?.trim();
  if (tipo !== "pagar" && tipo !== "receber") {
    return NextResponse.json({ error: "tipo deve ser pagar ou receber" }, { status: 400 });
  }

  const descricao = body.descricao?.trim();
  if (!descricao) {
    return NextResponse.json({ error: "descricao é obrigatória" }, { status: 400 });
  }

  const valor = Number(body.valor);
  if (!Number.isFinite(valor) || valor <= 0) {
    return NextResponse.json({ error: "valor inválido" }, { status: 400 });
  }

  const vencimento =
    body.vencimento != null && String(body.vencimento).trim()
      ? String(body.vencimento).slice(0, 10)
      : null;

  const tenantId = tenantIdFromRequest(request.headers) || auth.ctx.tenantId;
  const supabase = crmDb();

  const row: Record<string, unknown> = {
    descricao,
    valor,
    vencimento,
    status: "pendente",
    tenant_id: tenantId,
    atualizado_em: new Date().toISOString(),
  };

  // Vínculo opcional com o negócio de origem (só recebíveis). Gravação best-effort:
  // se a coluna negocio_id ainda não existir na base, salva sem o vínculo.
  const negocioId =
    tipo === "receber" && typeof body.negocio_id === "string" && UUID_RE.test(body.negocio_id)
      ? body.negocio_id
      : null;
  if (negocioId) row.negocio_id = negocioId;

  const table = tipo === "pagar" ? "hub_contas_pagar" : "hub_contas_receber";

  // Anti-duplicação do recebível: um negócio gera NO MÁXIMO uma conta a receber.
  // Se já existir recebível para este negocio_id (no tenant), retorna o existente em
  // vez de criar outro. Tolerante: se a coluna negocio_id ainda não existir, ignora a
  // checagem (a base antiga não duplica por negócio porque nem grava o vínculo).
  if (negocioId) {
    const existente = await supabase
      .from("hub_contas_receber")
      .select("id")
      .eq("negocio_id", negocioId)
      .or(tenantScopeOrFilter(tenantId))
      .limit(1)
      .maybeSingle();
    if (!existente.error && existente.data?.id) {
      return NextResponse.json(
        { ok: true, id: existente.data.id, tipo, ja_existia: true },
        { status: 200 },
      );
    }
    // existente.error de coluna ausente → segue para o insert (base sem o vínculo).
  }

  let { data, error } = await supabase.from(table).insert(row).select("id").single();

  // Base ainda sem a coluna negocio_id: reinsere sem o vínculo (não perde o lançamento).
  if (error && negocioId && isMissingPgColumn(error)) {
    delete row.negocio_id;
    ({ data, error } = await supabase.from(table).insert(row).select("id").single());
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data?.id, tipo }, { status: 201 });
}
