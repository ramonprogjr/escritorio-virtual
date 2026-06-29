import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { tenantScopeOrFilter, isMissingPgColumn } from "@/lib/tenant-default";
import { DISCIPLINAS_PADRAO } from "@/lib/obras/eap-presets";

const SELECT =
  "id, categoria, codigo, descricao, unidade, grupo, disciplina_slug, cor, ativo, ordem";

/**
 * GET /api/crm/catalogo?categoria=disciplina
 * Master dos dropdowns (Click-and-Go): disciplinas, áreas/andares, materiais.
 * Lê global (tenant_id NULL) + do tenant. Tolerante: sem a tabela (migração E0 pendente)
 * devolve as 15 disciplinas in-code para a categoria "disciplina".
 *
 * NOTA de rota: o design lista `/api/catalogo`; mantemos no namespace `/api/crm/*` por
 * consistência com todas as rotas CRM (auth requireCrm*, mesmo client). Divergência menor.
 */
export async function GET(request: NextRequest) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const categoria = request.nextUrl.searchParams.get("categoria") || "";

  let query = crmDb()
    .from("hub_catalogo")
    .select(SELECT)
    .or(tenantScopeOrFilter(g.ctx.tenantId))
    .eq("ativo", true)
    .order("ordem", { ascending: true });

  if (categoria) query = query.eq("categoria", categoria);

  const { data, error } = await query;

  if (error) {
    // Tolerância: tabela não existe ainda → fallback in-code (só disciplinas têm espelho).
    if (isMissingPgColumn(error) || /relation .*does not exist/i.test(error.message)) {
      const fallback =
        !categoria || categoria === "disciplina"
          ? DISCIPLINAS_PADRAO.map((d, i) => ({
              id: `fallback-${d.slug}`,
              categoria: "disciplina",
              codigo: d.codigo,
              descricao: d.label,
              unidade: null,
              grupo: null,
              disciplina_slug: d.slug,
              cor: d.cor,
              ativo: true,
              ordem: i,
            }))
          : [];
      return NextResponse.json({ data: fallback, migracao_pendente: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [], migracao_pendente: false });
}
