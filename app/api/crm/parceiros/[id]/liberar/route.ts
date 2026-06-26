import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { requireCrmGestor } from "@/lib/crm/crm-api-auth";
import { registrarEvento } from "@/lib/crm/registrar-evento";

type Params = { params: Promise<{ id: string }> };

/**
 * Hub libera um fornecedor bloqueado/pendente por pendência financeira ("nós podemos liberar").
 * Seta status_financeiro = 'em_dia' e registra o evento (auditoria). Só gestor/owner.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  const { id } = await params;
  const supabase = crmDb();

  const { data, error } = await supabase
    .from("hub_parceiros")
    .update({ status_financeiro: "em_dia", atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .select("id, nome, status_financeiro")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await registrarEvento(supabase, {
    event_type: "gate_liberado",
    entity_type: "fornecedor",
    entity_id: id,
    fornecedor_id: id,
    ator: "humano",
    payload: { parceiro_nome: data?.nome ?? null },
    tenant_id: g.ctx.tenantId,
  });

  return NextResponse.json({ ok: true, data });
}
