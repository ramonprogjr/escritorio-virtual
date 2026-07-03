import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { isMissingPgColumn, tenantScopeOrFilter } from "@/lib/tenant-default";

type Params = { params: Promise<{ id: string }> };
// `papel` é opcional: só pessoas/empresas participantes (via hub_negocio_vinculos) o carregam.
// Leads/obras/projetos/linhagem reusam o mesmo tipo sem papel — segue TUDO por nome (regra do dono).
type NamedRef = { id: string; nome: string; papel?: string };

const uniqStr = (arr: Array<string | null | undefined>): string[] =>
  [...new Set(arr.filter((v): v is string => !!v).map(String))];

/**
 * Relacionados de um NEGÓCIO, TUDO por nome (código de identidade escondido — regra do dono).
 * Escopo multi-tenant obrigatório em toda query (crmDb = service-role, RLS não protege).
 * A linhagem (pai/raiz/filhos) é best-effort: envolta em try + isMissingPgColumn, pois as
 * colunas negocio_pai_id/negocio_raiz_id são aditivas (Tier 0) e podem faltar em bancos antigos.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  const supabase = crmDb();
  const tenantId = g.ctx.tenantId;
  const scope = tenantScopeOrFilter(tenantId);

  // 1. Carrega o próprio negócio (com linhagem; degrada sem as colunas aditivas).
  const SELECT_FULL =
    "id, titulo, tenant_id, lead_id, pessoa_id, empresa_id, negocio_pai_id, negocio_raiz_id";
  const SELECT_BASE = "id, titulo, tenant_id, lead_id, pessoa_id, empresa_id";
  let temLinhagem = true;
  let { data: negocio, error } = await supabase
    .from("hub_negocios")
    .select(SELECT_FULL)
    .eq("id", id)
    .maybeSingle();
  if (
    error &&
    (isMissingPgColumn(error, "negocio_pai_id") || isMissingPgColumn(error, "negocio_raiz_id"))
  ) {
    temLinhagem = false;
    ({ data: negocio, error } = await supabase
      .from("hub_negocios")
      .select(SELECT_BASE)
      .eq("id", id)
      .maybeSingle());
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!negocio) return NextResponse.json({ error: "Negócio não encontrado" }, { status: 404 });
  // Isolamento de tenant (espelha o GET irmão do negócio): outro tenant → 404.
  if (negocio.tenant_id && negocio.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Negócio não encontrado" }, { status: 404 });
  }

  const neg = negocio as {
    id: string;
    titulo: string | null;
    lead_id: string | null;
    pessoa_id: string | null;
    empresa_id: string | null;
    negocio_pai_id?: string | null;
    negocio_raiz_id?: string | null;
  };

  // 2. Vínculos N:N (pessoas/empresas participantes). Degrada p/ vazio se a tabela sumir.
  const vincPessoaIds: string[] = [];
  const vincEmpresaIds: string[] = [];
  // Papel do vínculo (arquiteto/engenharia_executora/prestador/fornecedor/cliente/…), chaveado
  // por entidade_id. É o "quem é quem" do relacionado — retornado p/ a UI rotular ao lado do nome.
  const papelPorEntidade = new Map<string, string>();
  {
    // `papel` é coluna core de hub_negocio_vinculos; o SELECT é defensivo: se um banco antigo não
    // a tiver, degrada p/ o SELECT sem papel — nunca perde os vínculos por causa disso.
    const comPapel = await supabase
      .from("hub_negocio_vinculos")
      .select("entidade_tipo, entidade_id, papel")
      .eq("negocio_id", id)
      .limit(200);
    const semPapel =
      comPapel.error && isMissingPgColumn(comPapel.error, "papel")
        ? await supabase
            .from("hub_negocio_vinculos")
            .select("entidade_tipo, entidade_id")
            .eq("negocio_id", id)
            .limit(200)
        : null;
    const vErr = semPapel ? semPapel.error : comPapel.error;
    const vinc = (semPapel ? semPapel.data : comPapel.data) as
      | Array<{ entidade_tipo: unknown; entidade_id: unknown; papel?: unknown }>
      | null;
    if (!vErr) {
      for (const row of vinc ?? []) {
        const eid = row.entidade_id ? String(row.entidade_id) : "";
        if (!eid) continue;
        const papel = row.papel ? String(row.papel) : "";
        // 1ª ocorrência vence (o índice único já garante 1 vínculo por entidade neste negócio).
        if (papel && !papelPorEntidade.has(eid)) papelPorEntidade.set(eid, papel);
        if (String(row.entidade_tipo) === "pessoa") vincPessoaIds.push(eid);
        else if (String(row.entidade_tipo) === "empresa") vincEmpresaIds.push(eid);
      }
    }
  }

  const pessoaIds = uniqStr([neg.pessoa_id, ...vincPessoaIds]);
  const empresaIds = uniqStr([neg.empresa_id, ...vincEmpresaIds]);

  // 3. Busca nomes em lote + entregas (obras/projetos) + lead de origem.
  const [pessoasRes, empresasRes, leadRes, obrasRes, projetosRes] = await Promise.all([
    pessoaIds.length
      ? supabase.from("hub_pessoas").select("id, nome").in("id", pessoaIds).or(scope)
      : Promise.resolve({ data: [] as Array<{ id: string; nome: string | null }>, error: null }),
    empresaIds.length
      ? supabase.from("hub_empresas").select("id, razao_social, nome_fantasia").in("id", empresaIds).or(scope)
      : Promise.resolve({
          data: [] as Array<{ id: string; razao_social: string | null; nome_fantasia: string | null }>,
          error: null,
        }),
    neg.lead_id
      ? supabase.from("hub_leads_crm").select("id, nome").eq("id", neg.lead_id).or(scope).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("hub_obras").select("id, titulo").eq("negocio_id", id).or(scope).limit(50),
    supabase.from("hub_projetos").select("id, titulo").eq("negocio_id", id).or(scope).limit(50),
  ]);

  const pessoas: NamedRef[] = pessoasRes.error
    ? []
    : (pessoasRes.data ?? []).map((p) => {
        const pid = String(p.id);
        const papel = papelPorEntidade.get(pid);
        const base: NamedRef = { id: pid, nome: String(p.nome ?? "—") };
        return papel ? { ...base, papel } : base;
      });

  const empresas: NamedRef[] = empresasRes.error
    ? []
    : (empresasRes.data ?? []).map((e) => {
        const eid = String(e.id);
        const papel = papelPorEntidade.get(eid);
        const base: NamedRef = { id: eid, nome: String(e.razao_social || e.nome_fantasia || "—") };
        return papel ? { ...base, papel } : base;
      });

  const leads: NamedRef[] =
    !leadRes.error && leadRes.data
      ? [{ id: String(leadRes.data.id), nome: String(leadRes.data.nome ?? "—") }]
      : [];

  const mapEntregas = (res: { data: unknown; error: unknown | null }): NamedRef[] =>
    res.error
      ? []
      : ((res.data as Array<{ id: string; titulo: string | null }>) ?? []).map((r) => ({
          id: String(r.id),
          nome: String(r.titulo ?? "—"),
        }));

  const obras = mapEntregas(obrasRes);
  const projetos = mapEntregas(projetosRes);

  // 4. Linhagem (origem/derivados) — best-effort, TUDO por título.
  let linhagem: { pai: NamedRef | null; raiz: NamedRef | null; filhos: NamedRef[] } = {
    pai: null,
    raiz: null,
    filhos: [],
  };
  if (temLinhagem) {
    try {
      const paiId = neg.negocio_pai_id ? String(neg.negocio_pai_id) : null;
      const raizId = neg.negocio_raiz_id ? String(neg.negocio_raiz_id) : null;
      const [paiRes, raizRes, filhosRes] = await Promise.all([
        paiId
          ? supabase.from("hub_negocios").select("id, titulo").eq("id", paiId).or(scope).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        raizId && raizId !== String(neg.id)
          ? supabase.from("hub_negocios").select("id, titulo").eq("id", raizId).or(scope).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase.from("hub_negocios").select("id, titulo").eq("negocio_pai_id", id).or(scope).limit(50),
      ]);
      linhagem = {
        pai:
          !paiRes.error && paiRes.data
            ? { id: String(paiRes.data.id), nome: String(paiRes.data.titulo ?? "—") }
            : null,
        raiz:
          !raizRes.error && raizRes.data
            ? { id: String(raizRes.data.id), nome: String(raizRes.data.titulo ?? "—") }
            : null,
        filhos: filhosRes.error
          ? []
          : ((filhosRes.data as Array<{ id: string; titulo: string | null }>) ?? []).map((f) => ({
              id: String(f.id),
              nome: String(f.titulo ?? "—"),
            })),
      };
    } catch (e) {
      // Defesa: coluna aditiva ausente ou qualquer falha na linhagem → cadeia vazia (não quebra a tela).
      if (!isMissingPgColumn(e)) linhagem = { pai: null, raiz: null, filhos: [] };
    }
  }

  return NextResponse.json({
    data: { pessoas, empresas, leads, obras, projetos, linhagem },
  });
}
