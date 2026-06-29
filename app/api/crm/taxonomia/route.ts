import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { carregarTaxonomia } from "@/lib/obras/taxonomia";

/**
 * GET /api/crm/taxonomia?disciplina=eletrica
 * Catálogo controlado de atividades (descritivo padrão + sinônimos). Serve a UI ambiente-first
 * (E2) e, futuramente, a IA do Orçamento (classifica memorial → códigos da taxonomia).
 *
 * Lê GLOBAL (tenant_id NULL) + do tenant via `.or(tenantScopeOrFilter)` (mesmo padrão de
 * /api/crm/catalogo). Tolerante: sem a tabela (migração E0.5 pendente), devolve o fallback
 * in-code de lib/obras/taxonomia.ts marcado com migracao_pendente=true — nunca quebra.
 *
 * NOTA de rota: mantido no namespace /api/crm/* por consistência com todas as rotas CRM
 * (auth requireCrmSessao, mesmo client). Mesma decisão de /api/crm/catalogo.
 */
export async function GET(request: NextRequest) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const disciplina = request.nextUrl.searchParams.get("disciplina")?.trim() || undefined;

  // carregarTaxonomia NÃO lança: devolve o fallback in-code se a tabela não existe.
  const { data, migracaoPendente } = await carregarTaxonomia(crmDb(), g.ctx.tenantId, disciplina);

  return NextResponse.json({ data, migracao_pendente: migracaoPendente });
}
