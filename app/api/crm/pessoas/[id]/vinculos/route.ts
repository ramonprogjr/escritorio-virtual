import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { tenantScopeOrFilter } from "@/lib/tenant-default";

type Params = { params: Promise<{ id: string }> };
type ObraRef = { id: string; titulo: string };

/**
 * Carrega obras/projetos ligados aos negócios da pessoa/empresa, EM LOTE (uma query cada).
 * Escopo multi-tenant obrigatório (crmDb usa service-role → RLS não protege).
 * Degrada para [] quando a tabela/coluna ainda não existe (42P01 / 42703).
 */
async function carregarEntregasDosNegocios(
  supabase: ReturnType<typeof crmDb>,
  negocioIds: string[],
  tenantId: string
): Promise<{ obras: ObraRef[]; projetos: ObraRef[] }> {
  if (negocioIds.length === 0) return { obras: [], projetos: [] };

  const scope = tenantScopeOrFilter(tenantId);
  const [obrasRes, projetosRes] = await Promise.all([
    supabase.from("hub_obras").select("id, titulo").in("negocio_id", negocioIds).or(scope).limit(50),
    supabase.from("hub_projetos").select("id, titulo").in("negocio_id", negocioIds).or(scope).limit(50),
  ]);

  const mapRefs = (res: { data: unknown; error: { code?: string } | null }): ObraRef[] => {
    if (res.error) return []; // 42P01 / 42703 (coluna/tabela ausente) ou qualquer falha → sem entregas
    return ((res.data as Array<{ id: string; titulo: string | null }>) ?? []).map((r) => ({
      id: String(r.id),
      titulo: String(r.titulo ?? "—"),
    }));
  };

  return { obras: mapRefs(obrasRes), projetos: mapRefs(projetosRes) };
}

export async function GET(request: NextRequest, { params }: Params) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  const supabase = crmDb();
  const tenantId = g.ctx.tenantId;
  const scope = tenantScopeOrFilter(tenantId);

  // GUARD multi-tenant: a pessoa-raiz TEM que ser do tenant da sessão. crmDb() é service-role
  // (RLS não protege) e os ids são enumeráveis — sem este 404, passar um pessoa_id de OUTRO
  // tenant devolveria os vínculos/leads/negócios (PII) dele. Espelha a rota de rastreio do negócio.
  const { data: pessoaRaiz, error: raizErr } = await supabase
    .from("hub_pessoas")
    .select("id, tenant_id")
    .eq("id", id)
    .maybeSingle();
  if (raizErr) return NextResponse.json({ error: raizErr.message }, { status: 500 });
  if (!pessoaRaiz) return NextResponse.json({ error: "Pessoa não encontrada" }, { status: 404 });
  if (pessoaRaiz.tenant_id && pessoaRaiz.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Pessoa não encontrada" }, { status: 404 });
  }

  const { data: vinculos, error } = await supabase
    .from("hub_pessoas_empresas")
    .select("id, cargo, principal, empresa_id, hub_empresas(id, codigo, razao_social, nome_fantasia)")
    .eq("pessoa_id", id);

  if (error?.code === "42P01") {
    return NextResponse.json({
      data: { empresas: [], leads: [], negocios: [], obras: [], projetos: [] },
    });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const [{ data: leads }, { data: negocios }] = await Promise.all([
    supabase
      .from("hub_leads_crm")
      .select("id, nome, estagio, estagio_funil, criado_em")
      .eq("pessoa_id", id)
      .or(scope)
      .order("criado_em", { ascending: false })
      .limit(20),
    supabase
      .from("hub_negocios")
      .select("id, codigo, titulo, etapa, status, criado_em")
      .eq("pessoa_id", id)
      .or(scope)
      .order("criado_em", { ascending: false })
      .limit(20),
  ]);

  const negocioIds = (negocios ?? []).map((n) => String(n.id));
  const { obras, projetos } = await carregarEntregasDosNegocios(supabase, negocioIds, tenantId);

  return NextResponse.json({
    data: {
      empresas: (vinculos ?? []).map((v) => {
        const emp = v.hub_empresas as
          | { id: string; codigo: string | null; razao_social: string; nome_fantasia: string | null }
          | { id: string; codigo: string | null; razao_social: string; nome_fantasia: string | null }[]
          | null;
        const row = Array.isArray(emp) ? emp[0] : emp;
        return {
          vinculo_id: v.id,
          cargo: v.cargo,
          principal: v.principal,
          empresa_id: v.empresa_id,
          codigo: row?.codigo ?? null,
          razao_social: row?.razao_social ?? "—",
          nome_fantasia: row?.nome_fantasia ?? null,
        };
      }),
      leads: leads ?? [],
      negocios: negocios ?? [],
      obras,
      projetos,
    },
  });
}
