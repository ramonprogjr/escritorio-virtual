import { NextRequest, NextResponse } from "next/server";
import { registrarLogCrm } from "@/lib/crm/audit-log";
import { registrarEvento } from "@/lib/crm/registrar-evento";
import { validarMudancaNegocio } from "@/lib/crm/negocio-rules";
import { tipoFechoDaEtapa, statusDoFecho, eventTypeDoFecho } from "@/lib/crm/negocio-fecho";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmComercial, requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { isMissingPgColumn, tenantScopeOrFilter } from "@/lib/tenant-default";

type Params = { params: Promise<{ id: string }> };

// `proxima_acao_em` é aditiva (migração 20260629120000). Se o banco ainda não a tiver,
// caímos para o SELECT sem essa coluna — a tela funciona sem a data até a migração rodar.
const NEGOCIO_SELECT =
  "id, codigo, titulo, descricao, tipo, prefixo_mercado, lead_id, pessoa_id, empresa_id, pipeline_id, valor_estimado, valor_fechado, percentual_comissao, status, etapa, motivo_perda, proxima_acao, proxima_acao_em, data_previsao_fechamento, data_fechamento, tenant_id, criado_em, atualizado_em";

const NEGOCIO_SELECT_LEGACY =
  "id, codigo, titulo, descricao, tipo, prefixo_mercado, lead_id, pessoa_id, empresa_id, pipeline_id, valor_estimado, valor_fechado, percentual_comissao, status, etapa, motivo_perda, proxima_acao, data_previsao_fechamento, data_fechamento, tenant_id, criado_em, atualizado_em";

export async function GET(request: NextRequest, { params }: Params) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  const supabase = crmDb();

  let { data: negocio, error } = await supabase.from("hub_negocios").select(NEGOCIO_SELECT).eq("id", id).maybeSingle();
  // Banco sem a coluna aditiva proxima_acao_em → reconsulta sem ela (degrada sem quebrar).
  if (error && isMissingPgColumn(error, "proxima_acao_em")) {
    ({ data: negocio, error } = await supabase
      .from("hub_negocios")
      .select(NEGOCIO_SELECT_LEGACY)
      .eq("id", id)
      .maybeSingle());
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!negocio) return NextResponse.json({ error: "Negócio não encontrado" }, { status: 404 });
  if (negocio.tenant_id && negocio.tenant_id !== g.ctx.tenantId) {
    return NextResponse.json({ error: "Negócio não encontrado" }, { status: 404 });
  }

  const [{ data: atividades }, { data: lead }, { data: pessoa }, { data: propostas }] = await Promise.all([
    supabase.from("hub_atividades").select("*").eq("negocio_id", id).order("criado_em", { ascending: false }).limit(50),
    negocio.lead_id
      ? supabase.from("hub_leads_crm").select("id, nome, telefone, estagio").eq("id", negocio.lead_id).maybeSingle()
      : Promise.resolve({ data: null }),
    negocio.pessoa_id
      ? supabase.from("hub_pessoas").select("id, codigo, nome, email, telefone").eq("id", negocio.pessoa_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("hub_propostas").select("*").eq("negocio_id", id).order("criado_em", { ascending: false }),
  ]);

  // A1: etapas reais do pipeline deste negócio — a régua da ficha usa os slugs VÁLIDOS
  // (os fixos davam 400 nos pipelines de mercado). Sem pipeline → array vazio (a ficha
  // cai na lista legada).
  const pipelineId = (negocio as { pipeline_id?: string | null }).pipeline_id ?? null;
  let estagios: Array<{ slug: string; label: string; tipo_fecho: string | null }> = [];
  if (pipelineId) {
    const { data: est } = await supabase
      .from("hub_pipeline_estagios")
      .select("slug, label, tipo_fecho")
      .eq("pipeline_id", pipelineId)
      .eq("ativo", true)
      .order("ordem", { ascending: true });
    estagios = (est ?? []).map((e) => ({
      slug: String(e.slug),
      label: String(e.label ?? e.slug),
      tipo_fecho: e.tipo_fecho != null ? String(e.tipo_fecho) : null,
    }));
  }

  return NextResponse.json({
    data: negocio,
    lead: lead ?? null,
    pessoa: pessoa ?? null,
    timeline: atividades ?? [],
    propostas: propostas ?? [],
    estagios,
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const supabase = crmDb();
  const tenantId = g.ctx.tenantId;

  let { data: atual, error: fetchErr } = await supabase
    .from("hub_negocios")
    .select(NEGOCIO_SELECT)
    .eq("id", id)
    .maybeSingle();
  let proximaAcaoEmSuportada = true;
  if (fetchErr && isMissingPgColumn(fetchErr, "proxima_acao_em")) {
    proximaAcaoEmSuportada = false;
    ({ data: atual, error: fetchErr } = await supabase
      .from("hub_negocios")
      .select(NEGOCIO_SELECT_LEGACY)
      .eq("id", id)
      .maybeSingle());
  }

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!atual) return NextResponse.json({ error: "Negócio não encontrado" }, { status: 404 });
  // Isolamento de tenant (espelha o GET irmão): negócio de outro tenant é 404, nunca
  // editável. Fecha o vetor de um comercial alterar negócio/valores de outro tenant.
  if (atual.tenant_id && atual.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Negócio não encontrado" }, { status: 404 });
  }

  // A1: além de validar a etapa contra o pipeline, captura o tipo_fecho da etapa-alvo
  // (aberto/ganho/perdido) — é ele, não o slug literal "ganho", que decide status + KPI
  // nos pipelines de MERCADO (fechado_ganho/obra_criada/projeto_obra_criado/…).
  let tipoFechoAlvo: string | null = null;
  if (body.etapa && atual.pipeline_id) {
    const { data: estagios } = await supabase
      .from("hub_pipeline_estagios")
      .select("slug, tipo_fecho")
      .eq("pipeline_id", atual.pipeline_id)
      .eq("ativo", true);

    const slugs = new Set((estagios ?? []).map((e) => String(e.slug)));
    if (slugs.size > 0 && !slugs.has(String(body.etapa))) {
      return NextResponse.json({ error: "Etapa inválida para o pipeline deste negócio." }, { status: 400 });
    }
    const alvo = (estagios ?? []).find((e) => String(e.slug) === String(body.etapa));
    tipoFechoAlvo = alvo?.tipo_fecho != null ? String(alvo.tipo_fecho) : null;
  }

  // A1: deriva ganho/perdido pelo tipo_fecho (fallback: slug legado). Quando o caller move
  // para uma etapa de fecho SEM enviar `status` (o kanban só manda {etapa}), o status
  // canônico é derivado — sem isso, "ganho" de mercado ficava com status "aberto" e NÃO
  // abria "gerar entrega" nem contava nos KPIs de dinheiro.
  const fecho = body.etapa !== undefined ? tipoFechoDaEtapa(String(body.etapa), tipoFechoAlvo) : null;
  const statusDerivado = fecho && body.status === undefined ? statusDoFecho(fecho) : null;
  const statusFinal =
    body.status !== undefined ? String(body.status) : (statusDerivado ?? String(atual.status ?? ""));

  const merged = {
    etapa: (body.etapa !== undefined ? String(body.etapa) : atual.etapa) as string,
    status: statusFinal,
    motivo_perda:
      body.motivo_perda !== undefined
        ? (body.motivo_perda as string | null)
        : ((atual as { motivo_perda?: string }).motivo_perda ?? null),
    pessoa_id:
      body.pessoa_id !== undefined ? (body.pessoa_id as string | null) : (atual.pessoa_id as string | null),
    responsavel_id: body.responsavel_id as string | undefined,
    proxima_acao:
      body.proxima_acao !== undefined
        ? (body.proxima_acao as string | null)
        : ((atual as { proxima_acao?: string }).proxima_acao ?? null),
  };

  const check = validarMudancaNegocio(merged);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const allowed = [
    "titulo",
    "descricao",
    "tipo",
    "prefixo_mercado",
    "pessoa_id",
    "empresa_id",
    "lead_id",
    "pipeline_id",
    "valor_estimado",
    "valor_fechado",
    "percentual_comissao",
    "status",
    "etapa",
    "motivo_perda",
    "proxima_acao",
    "proxima_acao_em",
    "data_previsao_fechamento",
    "data_fechamento",
  ] as const;

  const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }
  // A1: grava o status derivado do fecho quando o caller (ex.: kanban) só mandou {etapa}.
  if (statusDerivado) patch.status = statusDerivado;

  const etapaAnterior = String(atual.etapa ?? "");

  // Se o banco ainda não tem proxima_acao_em, não envia essa coluna e usa o SELECT legado.
  if (!proximaAcaoEmSuportada) delete patch.proxima_acao_em;

  // Banco sem a coluna aditiva proxima_acao_em → não tenta gravar essa coluna.
  if (!proximaAcaoEmSuportada) delete patch.proxima_acao_em;

  // Atualiza e lê de volta com o SELECT base (literal → tipagem estável do parser).
  // A coluna aditiva é refletida no cliente de forma otimista; o retorno usa o SELECT legado.
  // Update SEMPRE com escopo de tenant (id + tenant atual / legado / NULL). Já checamos
  // `atual` acima, mas o filtro no UPDATE evita TOCTOU e garante que nenhuma linha de
  // outro tenant seja gravada mesmo sob corrida. Usa o mesmo `tenantScopeOrFilter` da
  // listagem para não quebrar registros legados (tenant_id NULL / Obra10 padrão).
  let { data, error } = await supabase
    .from("hub_negocios")
    .update(patch)
    .eq("id", id)
    .or(tenantScopeOrFilter(tenantId))
    .select(NEGOCIO_SELECT_LEGACY)
    .single();
  if (error && isMissingPgColumn(error, "proxima_acao_em")) {
    // Defesa extra: se ainda assim o banco reclamar da coluna, remove e refaz.
    delete patch.proxima_acao_em;
    ({ data, error } = await supabase
      .from("hub_negocios")
      .update(patch)
      .eq("id", id)
      .or(tenantScopeOrFilter(tenantId))
      .select(NEGOCIO_SELECT_LEGACY)
      .single());
  }
  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Falha ao atualizar negócio." }, { status: 500 });
  }

  if (body.etapa && String(body.etapa) !== etapaAnterior) {
    await supabase.from("hub_atividades").insert({
      negocio_id: id,
      lead_id: data.lead_id,
      tipo: "status_change",
      descricao: `Etapa: ${etapaAnterior || "—"} → ${data.etapa}`,
      feito_por: "humano",
      feito_por_tipo: "humano",
      tenant_id: tenantId,
    });

    await registrarLogCrm(supabase, {
      entidade: "negocio",
      entidade_id: id,
      acao: "etapa_alterada",
      valor_anterior: etapaAnterior || null,
      valor_novo: String(data.etapa),
      motivo: merged.motivo_perda,
      tenant_id: tenantId,
    });

    // Keystone F4 (hub_eventos): evento de FUNIL para KPIs/dashboards. Best-effort — nunca
    // bloqueia o PATCH. ganho/perdido são as métricas de dinheiro; demais → etapa_mudou.
    const etapaNova = String(data.etapa);
    const fechoNovo = tipoFechoDaEtapa(etapaNova, tipoFechoAlvo);
    await registrarEvento(supabase, {
      event_type: eventTypeDoFecho(fechoNovo),
      entity_type: "negocio",
      entity_id: id,
      negocio_id: id,
      lead_id: data.lead_id ? String(data.lead_id) : null,
      ator: "humano",
      payload: {
        etapa_anterior: etapaAnterior || null,
        etapa_nova: etapaNova,
        ...(fechoNovo === "perdido" && merged.motivo_perda
          ? { motivo: String(merged.motivo_perda) }
          : {}),
      },
      tenant_id: tenantId,
    });
  }

  // PROPOR + CONFIRMAR (decisão do dono 02/jul — Tier 0.10): ao GANHAR, o sistema NÃO cria a
  // entrega (obra/projeto) sozinho. Um "ganho" por engano criaria uma obra REAL que a regra
  // "nada se apaga" tornaria lixo imortal em produção. A criação é um gate HUMANO: o painel
  // "Negócio ganho — gerar entrega" na ficha do negócio chama POST /negocios/[id]/converter-obra
  // no clique. A derivação (derivarEntregaDoNegocio) segue viva, idempotente, atrás desse clique.

  // O SELECT de retorno é o legado (tipagem estável); reanexa proxima_acao_em quando suportada,
  // para o cliente receber a data atualizada/gravada sem nova consulta.
  const dataOut =
    proximaAcaoEmSuportada && "proxima_acao_em" in patch
      ? { ...data, proxima_acao_em: patch.proxima_acao_em ?? null }
      : data;

  return NextResponse.json({ data: dataOut });
}
