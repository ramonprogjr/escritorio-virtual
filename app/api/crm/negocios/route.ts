import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  gerarCodigoNegocio,
  validarNegocioCadastro,
  type NegocioCadastroPayload,
} from "@/lib/crm/negocio-cadastro";
import { prepararRowHubLeadInsert } from "@/lib/crm/lead-cadastro";
import { criarVinculosNegocio } from "@/lib/crm/negocio-vinculos";
import { resolverPipelineNegocioPorMercado } from "@/lib/crm/resolve-pipeline";
import { isMissingPgColumn, isTenantFkError, tenantScopeOrFilter } from "@/lib/tenant-default";
import { requireCrmComercial, requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { legacyNegocioTipoFromMercado } from "@/lib/crm/negocio-tipo";
import { sanitizarBuscaPostgrest } from "@/lib/crm/sanitizar-busca-postgrest";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function supabaseConfigError(): string | null {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    return "NEXT_PUBLIC_SUPABASE_URL nao esta definida no servidor.";
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return "SUPABASE_SERVICE_ROLE_KEY nao esta definida no servidor.";
  }
  return null;
}

const NEGOCIO_OPTIONAL_COLUMNS = [
  "tenant_id",
  "lead_id",
  "pessoa_id",
  "empresa_id",
  "descricao",
  "tipo",
  "pipeline_id",
] as const;

const LEGACY_LEAD_INSERT_SELECT = "id, codigo, nome";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type EntidadeCodigo = {
  id: string;
  codigo: string | null;
};

function isLegacyLeadRequiredError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  if (String(e.code || "") !== "23502") return false;
  const message = String(e.message || "").toLowerCase();
  return message.includes("lead_id") && message.includes("null value");
}

function isLegacyTipoRequiredError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  if (String(e.code || "") !== "23502") return false;
  const message = String(e.message || "").toLowerCase();
  return message.includes("tipo") && message.includes("null value");
}

function isLegacyTipoCheckError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  if (String(e.code || "") !== "23514") return false;
  const message = String(e.message || "").toLowerCase();
  return message.includes("tipo");
}

function parseUuidList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    const id = typeof item === "string" ? item.trim() : "";
    if (!id || !UUID_RE.test(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

function mergeIds(...lists: Array<(string | null | undefined)[] | string[]>) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const list of lists) {
    for (const raw of list) {
      const id = String(raw || "").trim();
      if (!id || !UUID_RE.test(id) || seen.has(id)) continue;
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}

async function carregarCodigosEntidade(
  supabase: SupabaseClient,
  table: "hub_leads_crm" | "hub_pessoas" | "hub_empresas" | "hub_parceiros",
  ids: string[],
  erroLabel: string
): Promise<EntidadeCodigo[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.from(table).select("id, codigo").in("id", ids);
  if (error) throw new Error(error.message);

  const rows = ((data ?? []) as Array<{ id: string; codigo?: string | null }>).map((row) => ({
    id: String(row.id),
    codigo: row.codigo != null ? String(row.codigo) : null,
  }));

  const encontrados = new Set(rows.map((row) => row.id));
  const faltantes = ids.filter((id) => !encontrados.has(id));
  if (faltantes.length) {
    throw new Error(`${erroLabel} não encontrado(s).`);
  }
  return rows;
}

async function insertHubNegocio(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
  tenantId: string
) {
  const baseRow = { ...row };
  let withTenant = !!tenantId;
  let payload: Record<string, unknown> = withTenant ? { ...baseRow, tenant_id: tenantId } : { ...baseRow };
  let lastError: { message?: string; code?: string } | null = null;

  for (let attempt = 0; attempt < NEGOCIO_OPTIONAL_COLUMNS.length + 5; attempt++) {
    const { data, error } = await supabase
      .from("hub_negocios")
      .insert(payload)
      .select("*")
      .single();

    if (!error) return { data, error: null };

    lastError = error;

    if (isTenantFkError(error)) {
      withTenant = false;
      delete (baseRow as Record<string, unknown>).tenant_id;
      payload = { ...baseRow };
      continue;
    }

    if (isMissingPgColumn(error, "tenant_id")) {
      withTenant = false;
      delete (baseRow as Record<string, unknown>).tenant_id;
      payload = { ...baseRow };
      continue;
    }

    const missing = NEGOCIO_OPTIONAL_COLUMNS.find((col) => isMissingPgColumn(error, col));
    if (missing) {
      delete (baseRow as Record<string, unknown>)[missing];
      payload = withTenant ? { ...baseRow, tenant_id: tenantId } : { ...baseRow };
      continue;
    }

    const code = "code" in error ? String(error.code) : "";
    const msg = "message" in error ? String(error.message) : "";
    if (code === "PGRST205" || msg.includes("hub_negocios")) {
      return {
        data: null,
        error: {
          message:
            "Tabela hub_negocios nao existe no Supabase. Execute a migracao 20260522120000_ensure_hub_negocios.sql no SQL Editor.",
          code,
        },
      };
    }
    return { data: null, error };
  }

  return {
    data: null,
    error: {
      message: lastError?.message?.trim() || "Falha ao gravar hub_negocios.",
      code: lastError?.code,
    },
  };
}

async function insertHubLeadCompat(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
  tenantId: string
) {
  const variants: Record<string, unknown>[] = [
    { ...row, tenant_id: tenantId },
    { ...row, tenant_id: tenantId, pessoa_id: undefined },
    { ...row },
  ];
  const noPessoa = { ...row };
  delete noPessoa.pessoa_id;
  variants.push({ ...noPessoa, tenant_id: tenantId }, { ...noPessoa });

  let lastError: { message?: string; code?: string } | null = null;

  for (const payload of variants) {
    const clean = { ...payload };
    if (clean.pessoa_id === undefined) delete clean.pessoa_id;

    const { data, error } = await supabase
      .from("hub_leads_crm")
      .insert(clean)
      .select(LEGACY_LEAD_INSERT_SELECT)
      .single();

    if (!error) return { data, error: null };

    lastError = error;
    const code = "code" in error ? String(error.code) : "";
    const msg = "message" in error ? String(error.message) : "";
    if (code === "PGRST205" || msg.includes("hub_leads_crm")) {
      return {
        data: null,
        error: {
          message:
            "Tabela hub_leads_crm nao existe no Supabase. Execute a migracao 20260522130000_ensure_hub_leads_crm.sql no SQL Editor.",
          code,
        },
      };
    }
    if (
      !isMissingPgColumn(error, "tenant_id") &&
      !isMissingPgColumn(error, "pessoa_id") &&
      !isMissingPgColumn(error, "codigo")
    ) {
      return { data: null, error };
    }
  }

  return {
    data: null,
    error: lastError ?? { message: "Falha ao gravar hub_leads_crm." },
  };
}

async function criarLeadCompatParaNegocio(
  supabase: SupabaseClient,
  opts: {
    titulo: string;
    etapa: string;
    prefixo_mercado: string;
    valor_estimado: number | null;
    pessoa_id?: string | null;
    tenantId: string;
  }
): Promise<EntidadeCodigo> {
  const now = new Date().toISOString();
  const rowBase: Record<string, unknown> = {
    nome: `Negócio direto · ${opts.titulo}`.slice(0, 200),
    telefone: null,
    email: null,
    origem: "outro",
    estagio: opts.etapa || "qualificado",
    valor_estimado: opts.valor_estimado ?? 0,
    score: 60,
    pessoa_id: opts.pessoa_id || null,
    criado_em: now,
    atualizado_em: now,
    metadata: {
      origem_cadastro: "negocio_direto",
      lead_proxy_legacy: true,
      negocio_titulo: opts.titulo,
      negocio_mercado: opts.prefixo_mercado,
    },
  };

  const row = await prepararRowHubLeadInsert(supabase, rowBase);
  const { data, error } = await insertHubLeadCompat(supabase, row, opts.tenantId);
  if (error || !data?.id) {
    throw new Error(
      ("message" in (error || {}) && error?.message) ||
        "Não foi possível criar o lead de apoio exigido pelo schema legado."
    );
  }

  return {
    id: String(data.id),
    codigo: data.codigo != null ? String(data.codigo) : null,
  };
}

export async function GET(request: NextRequest) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const supabase = db();
  const { searchParams } = new URL(request.url);
  const busca = sanitizarBuscaPostgrest(searchParams.get("busca") || "");
  const status = searchParams.get("status") || "";
  const etapa = searchParams.get("etapa") || "";
  const prefixo = searchParams.get("prefixo_mercado") || "";
  const pipelineId = searchParams.get("pipeline_id") || "";
  const offset = parseInt(searchParams.get("offset") || "0");
  const limit = 20;
  const tenantId = g.ctx.tenantId;

  // `proxima_acao_em` é aditiva (migração 20260629120000): se ausente, recai no select base.
  const construirQuery = (selectStr: string) => {
    let query = supabase
      .from("hub_negocios")
      .select(selectStr, { count: "exact" })
      .or(tenantScopeOrFilter(tenantId))
      .order("criado_em", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq("status", status);
    if (etapa) query = query.eq("etapa", etapa);
    if (prefixo) query = query.eq("prefixo_mercado", prefixo);
    if (pipelineId) query = query.eq("pipeline_id", pipelineId);
    if (busca) {
      query = query.or(`titulo.ilike.%${busca}%,codigo.ilike.%${busca}%`);
    }
    return query;
  };

  const LIST_SELECT =
    "id, codigo, titulo, prefixo_mercado, status, etapa, valor_estimado, valor_fechado, data_previsao_fechamento, pipeline_id, criado_em, proxima_acao, proxima_acao_em";
  const LIST_SELECT_LEGACY =
    "id, codigo, titulo, prefixo_mercado, status, etapa, valor_estimado, valor_fechado, data_previsao_fechamento, pipeline_id, criado_em, proxima_acao";

  let { data, error, count } = await construirQuery(LIST_SELECT);
  if (error && isMissingPgColumn(error, "proxima_acao_em")) {
    ({ data, error, count } = await construirQuery(LIST_SELECT_LEGACY));
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Soma REAL sobre TODO o pipeline (não só a página de 20): KPI não pode mudar ao paginar.
  // PRIMÁRIO: agrega no BANCO via RPC (SUM/COUNT por etapa) — sem teto de linhas, correto
  // para tenants grandes. FALLBACK (RPC ausente nesta base): agregação no app com limite
  // elevado e documentado. A função RPC é aditiva (migração 20260702120000, não aplicada).
  const etapaTotais: Record<string, number> = {};
  const etapaCounts: Record<string, number> = {};
  let pipelineTotal = 0;
  let agregadoNoBanco = false;

  const { data: rpcData, error: rpcErr } = await supabase.rpc("crm_negocios_pipeline_totais", {
    p_tenant_id: g.ctx.tenantId,
    p_status: status || null,
    p_etapa: etapa || null,
    p_prefixo: prefixo || null,
    p_pipeline_id: pipelineId || null,
    p_busca: busca || null,
  });

  if (!rpcErr && Array.isArray(rpcData)) {
    // Linhas: { etapa, total, qtd }. Soma do "aberto" exclui ganho/perdido.
    for (const r of rpcData as Array<{ etapa?: unknown; total?: unknown; qtd?: unknown }>) {
      const e = String(r.etapa ?? "");
      const total = Number(r.total ?? 0);
      const qtd = Number(r.qtd ?? 0);
      etapaTotais[e] = total;
      etapaCounts[e] = qtd;
      if (!["ganho", "perdido"].includes(e)) pipelineTotal += total;
    }
    agregadoNoBanco = true;
  }

  // FALLBACK app-side (só quando a RPC não existe/erra nesta base). Limite elevado a 50k
  // como salvaguarda; o caminho correto é a RPC acima (sem teto). Mantém o KPI estável ao
  // paginar mesmo antes de a migração da função ser aplicada.
  if (!agregadoNoBanco) {
    let aggQuery = supabase
      .from("hub_negocios")
      .select("valor_estimado, valor_fechado, etapa")
      .or(tenantScopeOrFilter(g.ctx.tenantId))
      .limit(50000);
    if (status) aggQuery = aggQuery.eq("status", status);
    if (etapa) aggQuery = aggQuery.eq("etapa", etapa);
    if (prefixo) aggQuery = aggQuery.eq("prefixo_mercado", prefixo);
    if (pipelineId) aggQuery = aggQuery.eq("pipeline_id", pipelineId);
    if (busca) aggQuery = aggQuery.or(`titulo.ilike.%${busca}%,codigo.ilike.%${busca}%`);

    const { data: aggData } = await aggQuery;
    const valorDe = (r: unknown) =>
      Number(
        (r as { valor_fechado?: number | null; valor_estimado?: number | null }).valor_fechado ??
          (r as { valor_estimado?: number | null }).valor_estimado ??
          0,
      );
    const etapaDe = (r: unknown) => String((r as { etapa?: unknown }).etapa ?? "");

    for (const r of aggData ?? []) {
      const e = etapaDe(r);
      etapaTotais[e] = (etapaTotais[e] ?? 0) + valorDe(r);
      etapaCounts[e] = (etapaCounts[e] ?? 0) + 1;
    }
    pipelineTotal = (aggData ?? [])
      .filter((r) => !["ganho", "perdido"].includes(etapaDe(r)))
      .reduce((s, r) => s + valorDe(r), 0);
  }

  return NextResponse.json({
    data: data ?? [],
    total: count ?? 0,
    pipeline_total: pipelineTotal,
    etapa_totais: etapaTotais,
    etapa_counts: etapaCounts,
  });
}

export async function POST(request: NextRequest) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const configErr = supabaseConfigError();
  if (configErr) {
    return NextResponse.json(
      { error: "CRM indisponivel: Supabase nao configurado no servidor.", detail: configErr },
      { status: 503 }
    );
  }

  const supabase = db();
  const tenantId = g.ctx.tenantId;

  let body: Partial<NegocioCadastroPayload> & {
    pipeline_id?: string | null;
    empresa_id?: string | null;
    parceiro_id?: string | null;
    lead_ids?: string[];
    pessoa_ids?: string[];
    empresa_ids?: string[];
    parceiro_ids?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const validacao = validarNegocioCadastro(body);
  if (!validacao.ok) {
    return NextResponse.json({ error: validacao.erro }, { status: 400 });
  }

  const d = validacao.data;
  // pipeline_id vem do cliente; se faltar, resolve pelo mercado (negócio entra no funil
  // do seu mercado automaticamente — fallback pipeline global).
  const pipeline_id =
    (typeof body.pipeline_id === "string" && body.pipeline_id.trim()
      ? body.pipeline_id.trim()
      : null) ?? (await resolverPipelineNegocioPorMercado(supabase, d.prefixo_mercado));
  const empresa_id =
    typeof body.empresa_id === "string" && body.empresa_id.trim()
      ? body.empresa_id.trim()
      : null;
  const parceiro_id =
    typeof body.parceiro_id === "string" && body.parceiro_id.trim()
      ? body.parceiro_id.trim()
      : null;

  const leadIds = mergeIds(parseUuidList(body.lead_ids), d.lead_id ? [d.lead_id] : []);
  const pessoaIds = mergeIds(parseUuidList(body.pessoa_ids), d.pessoa_id ? [d.pessoa_id] : []);
  const empresaIds = mergeIds(parseUuidList(body.empresa_ids), empresa_id ? [empresa_id] : []);
  const parceiroIds = mergeIds(parseUuidList(body.parceiro_ids), parceiro_id ? [parceiro_id] : []);

  let leadsSelecionados: EntidadeCodigo[] = [];
  let pessoasSelecionadas: EntidadeCodigo[] = [];
  let empresasSelecionadas: EntidadeCodigo[] = [];
  let parceirosSelecionados: EntidadeCodigo[] = [];

  try {
    [leadsSelecionados, pessoasSelecionadas, empresasSelecionadas, parceirosSelecionados] =
      await Promise.all([
        carregarCodigosEntidade(supabase, "hub_leads_crm", leadIds, "Lead"),
        carregarCodigosEntidade(supabase, "hub_pessoas", pessoaIds, "Pessoa"),
        carregarCodigosEntidade(supabase, "hub_empresas", empresaIds, "Empresa"),
        carregarCodigosEntidade(supabase, "hub_parceiros", parceiroIds, "Parceiro"),
      ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao validar vínculos do negócio.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const codigo = await gerarCodigoNegocio(supabase, d.prefixo_mercado);
  const now = new Date().toISOString();

  const row: Record<string, unknown> = {
    codigo,
    titulo: d.titulo,
    tipo: legacyNegocioTipoFromMercado(d.prefixo_mercado),
    prefixo_mercado: d.prefixo_mercado,
    etapa: d.etapa,
    status: d.status,
    valor_estimado: d.valor_estimado,
    data_previsao_fechamento: d.data_previsao_fechamento,
    lead_id: leadsSelecionados[0]?.id ?? null,
    pessoa_id: pessoasSelecionadas[0]?.id ?? null,
    empresa_id: empresasSelecionadas[0]?.id ?? null,
    pipeline_id,
    criado_em: now,
    atualizado_em: now,
  };

  let compatWarning: string | null = null;
  let insertResult = await insertHubNegocio(supabase, row, tenantId);

  if (insertResult.error && isLegacyTipoRequiredError(insertResult.error)) {
    row.tipo = legacyNegocioTipoFromMercado(d.prefixo_mercado);
    compatWarning =
      "Schema legado exigia o campo tipo; foi aplicado um tipo compatível automaticamente.";
    insertResult = await insertHubNegocio(supabase, row, tenantId);
  }

  if (insertResult.error && isLegacyTipoCheckError(insertResult.error)) {
    row.tipo = "negocio";
    compatWarning =
      "Schema legado exigia um tipo diferente; foi aplicado um fallback genérico automaticamente.";
    insertResult = await insertHubNegocio(supabase, row, tenantId);
  }

  if (insertResult.error && isLegacyLeadRequiredError(insertResult.error) && !leadsSelecionados[0]?.id) {
    try {
      const leadCompat = await criarLeadCompatParaNegocio(supabase, {
        titulo: d.titulo,
        etapa: d.etapa,
        prefixo_mercado: d.prefixo_mercado,
        valor_estimado: d.valor_estimado,
        pessoa_id: pessoasSelecionadas[0]?.id ?? null,
        tenantId,
      });
      leadsSelecionados = [leadCompat, ...leadsSelecionados];
      row.lead_id = leadCompat.id;
      compatWarning =
        "Schema legado exigia lead principal; foi criado um lead de apoio automaticamente para o negócio.";
      insertResult = await insertHubNegocio(supabase, row, tenantId);
    } catch (err) {
      const detail =
        err instanceof Error
          ? err.message
          : "Não foi possível criar o lead de apoio exigido pelo schema legado.";
      return NextResponse.json(
        {
          error:
            "O seu banco ainda exige lead principal em hub_negocios. Selecione um lead no wizard ou aplique a migracao 20260522120000_ensure_hub_negocios.sql.",
          detail,
        },
        { status: 400 }
      );
    }
  }

  const { data: created, error } = insertResult;

  if (error) {
    const detail = "message" in error ? String(error.message) : "Erro desconhecido";
    const code = "code" in error ? String(error.code) : "";
    const status = code === "PGRST205" ? 503 : 500;
    return NextResponse.json({ error: detail, detail }, { status });
  }

  try {
    await criarVinculosNegocio(supabase, {
      negocio_id: String(created.id),
      leads: leadsSelecionados,
      pessoas: pessoasSelecionadas,
      empresas: empresasSelecionadas,
      parceiros: parceirosSelecionados,
      tenant_id: tenantId,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Falha ao gravar vínculos do negócio.";
    return NextResponse.json(
      {
        error: `Negócio criado, mas vínculos falharam: ${detail}`,
        data: created,
        detail,
        warning: compatWarning,
      },
      { status: 207 }
    );
  }

  return NextResponse.json({ data: created, warning: compatWarning }, { status: 201 });
}
