import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmGestor } from "@/lib/crm/crm-api-auth";
import { tenantScopeOrFilter } from "@/lib/tenant-default";

export type DistribuicaoDestino = { value: string; label: string };

/**
 * GET /api/crm/distribuicao/destinos — lista limpa de destinos para as regras
 * de roteamento (substitui o campo de digitar slug/id cru no /crm/distribuicao).
 *
 * - `agentes`: agentes/atendentes (value = agente_slug, o que o matcher usa).
 * - `parceiros`: fornecedores homologados (value = id).
 * Tenant-scoped (null-safe) + guard de gestor.
 */
export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  const supabase = crmDb();
  const scope = tenantScopeOrFilter(g.ctx.tenantId);

  const [agentesRes, parceirosRes] = await Promise.all([
    supabase
      .from("hub_agente_identidade")
      .select("agente_slug, nome, cargo")
      .or(scope)
      .order("nome", { ascending: true }),
    supabase
      .from("hub_parceiros")
      .select("id, nome")
      .or(scope)
      .order("nome", { ascending: true }),
  ]);

  if (agentesRes.error) {
    return NextResponse.json({ error: agentesRes.error.message }, { status: 500 });
  }
  if (parceirosRes.error) {
    return NextResponse.json({ error: parceirosRes.error.message }, { status: 500 });
  }

  const agentes: DistribuicaoDestino[] = (agentesRes.data ?? [])
    .filter((a) => typeof a.agente_slug === "string" && a.agente_slug.trim())
    .map((a) => ({
      value: String(a.agente_slug),
      label: a.cargo ? `${a.nome} · ${a.cargo}` : String(a.nome ?? a.agente_slug),
    }));

  const parceiros: DistribuicaoDestino[] = (parceirosRes.data ?? []).map((p) => ({
    value: String(p.id),
    label: String(p.nome ?? p.id),
  }));

  return NextResponse.json({ agentes, parceiros });
}
