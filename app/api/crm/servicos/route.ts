import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { tenantScopeOrFilter } from "@/lib/tenant-default";

/**
 * Catálogo de serviços do tenant — alimenta o Click-and-Go da proposta (escolher o serviço
 * pré-preenche título e faixa de valor). Só ativos, escopado no tenant. GET-only, leve.
 */
export async function GET(request: NextRequest) {
  const sessao = await requireCrmSessao(request);
  if ("error" in sessao) return sessao.error;
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { data, error } = await crmDb()
    .from("hub_servicos")
    .select("id, nome, categoria, faixa_preco_min, faixa_preco_max, prazo_medio_dias")
    .or(tenantScopeOrFilter(sessao.ctx.tenantId))
    .eq("ativo", true)
    .order("nome", { ascending: true })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ servicos: data ?? [] });
}
