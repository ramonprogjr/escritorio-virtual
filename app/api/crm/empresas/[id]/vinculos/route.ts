import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { tenantScopeOrFilter } from "@/lib/tenant-default";

type Params = { params: Promise<{ id: string }> };
type ObraRef = { id: string; titulo: string };
type NegocioRef = { id: string; codigo: string | null; titulo: string };

/** Obras/projetos ligados aos negócios (lote), escopados por tenant; degrada p/ [] (42P01/42703). */
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
    if (res.error) return []; // 42P01 / 42703 (isMissingPgColumn) ou qualquer falha → sem entregas
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

  // GUARD multi-tenant: a empresa-raiz TEM que ser do tenant da sessão. crmDb() é service-role
  // (RLS não protege) e os ids são enumeráveis — sem este 404, passar um empresa_id de OUTRO
  // tenant devolveria as pessoas vinculadas (PII) e negócios dele. Espelha a rota do negócio.
  const { data: empresaRaiz, error: raizErr } = await supabase
    .from("hub_empresas")
    .select("id, tenant_id")
    .eq("id", id)
    .maybeSingle();
  if (raizErr) return NextResponse.json({ error: raizErr.message }, { status: 500 });
  if (!empresaRaiz) return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  if (empresaRaiz.tenant_id && empresaRaiz.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const { data: vinculos, error } = await supabase
    .from("hub_pessoas_empresas")
    .select("id, cargo, principal, pessoa_id, hub_pessoas(id, codigo, nome, telefone, email)")
    .eq("empresa_id", id);

  if (error?.code === "42P01") {
    return NextResponse.json({
      data: { pessoas: [], negocios: [], obras: [], projetos: [] },
    });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const scope = tenantScopeOrFilter(tenantId);

  // Negócios onde a empresa é a titular (empresa_id) — igual ao comportamento anterior.
  const { data: negociosDiretos } = await supabase
    .from("hub_negocios")
    .select("id, codigo, titulo, etapa, status, criado_em")
    .eq("empresa_id", id)
    .or(scope)
    .order("criado_em", { ascending: false })
    .limit(20);

  const negociosMap = new Map<string, NegocioRef>();
  for (const n of negociosDiretos ?? []) {
    negociosMap.set(String(n.id), { id: String(n.id), codigo: n.codigo ?? null, titulo: String(n.titulo ?? "—") });
  }

  // Negócios onde a empresa participa (hub_negocio_vinculos, entidade_tipo='empresa') — dedupe por id.
  const { data: vinc, error: vincErr } = await supabase
    .from("hub_negocio_vinculos")
    .select("negocio_id")
    .eq("entidade_tipo", "empresa")
    .eq("entidade_id", id)
    .limit(100);

  if (!vincErr) {
    const participantIds = [
      ...new Set((vinc ?? []).map((r) => String(r.negocio_id)).filter((v) => v && !negociosMap.has(v))),
    ];
    if (participantIds.length > 0) {
      const { data: extra } = await supabase
        .from("hub_negocios")
        .select("id, codigo, titulo, criado_em")
        .in("id", participantIds)
        .or(scope)
        .order("criado_em", { ascending: false })
        .limit(50);
      for (const n of extra ?? []) {
        negociosMap.set(String(n.id), { id: String(n.id), codigo: n.codigo ?? null, titulo: String(n.titulo ?? "—") });
      }
    }
  }

  const negocios = [...negociosMap.values()];
  const negocioIds = negocios.map((n) => n.id);
  const { obras, projetos } = await carregarEntregasDosNegocios(supabase, negocioIds, tenantId);

  return NextResponse.json({
    data: {
      pessoas: (vinculos ?? []).map((v) => {
        const pes = v.hub_pessoas as
          | { id: string; codigo: string | null; nome: string; telefone: string | null; email: string | null }
          | { id: string; codigo: string | null; nome: string; telefone: string | null; email: string | null }[]
          | null;
        const row = Array.isArray(pes) ? pes[0] : pes;
        return {
          vinculo_id: v.id,
          cargo: v.cargo,
          principal: v.principal,
          pessoa_id: v.pessoa_id,
          codigo: row?.codigo ?? null,
          nome: row?.nome ?? "—",
          telefone: row?.telefone ?? null,
          email: row?.email ?? null,
        };
      }),
      negocios,
      obras,
      projetos,
    },
  });
}
