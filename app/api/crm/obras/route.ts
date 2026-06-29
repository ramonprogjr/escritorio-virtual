import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmComercial, requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { isMissingPgColumn } from "@/lib/tenant-default";
import {
  gerarCodigoObra,
  getPresetPorTipo,
  frentesDoPresetParaInsert,
  TIPOS_OBRA,
} from "@/lib/obras/eap-presets";

const TIPOS_VALIDOS = new Set<string>(TIPOS_OBRA.map((t) => t.slug));

// Colunas E0 (existem só após a migração). O SELECT cai para o legado se faltarem.
const SELECT_E0 =
  "id, codigo, codigo_legivel, titulo, tipo_obra, status, estagio_slug, cliente_pessoa_id, cliente_empresa_id, cidade, estado, area_total_m2, valor_contrato, data_inicio, negocio_id, criado_em";
const SELECT_LEGADO =
  "id, codigo, titulo, status, cidade, estado, data_inicio, negocio_id, criado_em";

export async function GET(request: NextRequest) {
  // AUDITORIA-FIX: auth unificado em requireCrm* (era tenantIdFromRequest, divergente de /projetos).
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const tenantId = g.ctx.tenantId;
  const status = request.nextUrl.searchParams.get("status") || "";
  const tipo = request.nextUrl.searchParams.get("tipo") || "";
  const negocioId = request.nextUrl.searchParams.get("negocio_id") || "";

  function montarQuery(select: string) {
    let q = crmDb()
      .from("hub_obras")
      .select(select, { count: "exact" })
      .eq("tenant_id", tenantId)
      .order("criado_em", { ascending: false })
      .limit(100);
    if (status) q = q.eq("status", status);
    if (negocioId) q = q.eq("negocio_id", negocioId);
    return q;
  }

  let query = montarQuery(SELECT_E0);
  if (tipo && TIPOS_VALIDOS.has(tipo)) query = query.eq("tipo_obra", tipo);

  let { data, error, count } = await query;

  // Tolerância: migração E0 ainda não aplicada → cai no SELECT legado, sem filtro de tipo.
  if (error && isMissingPgColumn(error)) {
    ({ data, error, count } = await montarQuery(SELECT_LEGADO));
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [], total: count ?? 0 });
}

export async function POST(request: NextRequest) {
  // AUDITORIA-FIX: comercial+ pela sessão (era header-based frouxo).
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const titulo = String(body.titulo || "").trim();
  if (!titulo) return NextResponse.json({ error: "Título obrigatório" }, { status: 400 });

  const tenantId = g.ctx.tenantId;
  const tipoObra =
    typeof body.tipo_obra === "string" && TIPOS_VALIDOS.has(body.tipo_obra)
      ? body.tipo_obra
      : "reforma";
  const supabase = crmDb();

  // Idempotência leve (anti double-tap): mesma obra (titulo+tenant) criada nos últimos 60s.
  {
    const desde = new Date(Date.now() - 60_000).toISOString();
    const { data: recente } = await supabase
      .from("hub_obras")
      .select("id, codigo, codigo_legivel, titulo")
      .eq("tenant_id", tenantId)
      .eq("titulo", titulo)
      .gte("criado_em", desde)
      .limit(1)
      .maybeSingle();
    if (recente?.id) {
      return NextResponse.json({ data: recente, idempotente: true }, { status: 200 });
    }
  }

  // AUDITORIA-FIX (P0): código ATÔMICO e POR TENANT (era COUNT(*) global → vazava entre tenants).
  const codigo = await gerarCodigoObra(supabase, tenantId, tipoObra);

  // Linha E0 completa. Se a migração não foi aplicada, cai para a linha legada.
  const rowE0: Record<string, unknown> = {
    codigo,
    codigo_legivel: codigo,
    titulo,
    tipo_obra: tipoObra,
    negocio_id: body.negocio_id || null,
    imovel_id: body.imovel_id || null,
    cliente_pessoa_id: body.cliente_pessoa_id || null,
    cliente_empresa_id: body.cliente_empresa_id || null,
    status: typeof body.status === "string" ? body.status : "planejamento",
    estagio_slug: "planejamento",
    endereco: body.endereco || null,
    cidade: body.cidade || null,
    estado: body.estado || null,
    area_total_m2: typeof body.area_total_m2 === "number" ? body.area_total_m2 : null,
    valor_contrato: typeof body.valor_contrato === "number" ? body.valor_contrato : null,
    tenant_id: tenantId,
  };

  let obra: Record<string, unknown> | null = null;
  let insErr: { message?: string; code?: string } | null = null;

  {
    const { data, error } = await supabase.from("hub_obras").insert(rowE0).select(SELECT_E0).single();
    obra = data as Record<string, unknown> | null;
    insErr = error;
  }

  // Retry-once em corrida do UNIQUE (tenant_id, codigo_legivel): o fallback do gerador não é
  // atômico (só a RPC gerar_codigo_obra é). Em 23505, regeneramos o código e tentamos 1× mais.
  if (insErr?.code === "23505") {
    const codigoRetry = await gerarCodigoObra(supabase, tenantId, tipoObra);
    const { data, error } = await supabase
      .from("hub_obras")
      .insert({ ...rowE0, codigo: codigoRetry, codigo_legivel: codigoRetry })
      .select(SELECT_E0)
      .single();
    obra = data as Record<string, unknown> | null;
    insErr = error;
  }

  // Tolerância: colunas E0 ausentes → insere o subconjunto legado (obra nasce sem EAP).
  let migracaoPendente = false;
  if (insErr && isMissingPgColumn(insErr)) {
    migracaoPendente = true;
    const rowLegado = {
      codigo,
      titulo,
      negocio_id: body.negocio_id || null,
      imovel_id: body.imovel_id || null,
      status: typeof body.status === "string" ? body.status : "planejamento",
      endereco: body.endereco || null,
      cidade: body.cidade || null,
      estado: body.estado || null,
      tenant_id: tenantId,
    };
    const { data, error } = await supabase
      .from("hub_obras")
      .insert(rowLegado)
      .select(SELECT_LEGADO)
      .single();
    obra = data as Record<string, unknown> | null;
    insErr = error;
  }

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  if (!obra?.id) return NextResponse.json({ error: "Falha ao criar obra." }, { status: 500 });

  // Monta a EAP do preset (se a migração estiver aplicada). Best-effort: a obra já existe;
  // se a tabela de frentes não existir ainda, devolvemos a obra + aviso (UI degrada).
  let frentesCriadas = 0;
  let avisoEap: string | null = null;

  if (!migracaoPendente) {
    const preset = getPresetPorTipo(tipoObra);
    if (preset) {
      const todasLinhas = frentesDoPresetParaInsert(preset, String(obra.id), tenantId);
      // C2 (Click-and-Go): honra a seleção do passo 3. `frentes_selecionadas` = disciplina_slugs marcados.
      // Guard: se vier ausente/vazio/não-array, criamos TODAS (comportamento original, tolerante).
      const selecRaw = body.frentes_selecionadas;
      const selecSet =
        Array.isArray(selecRaw) && selecRaw.length > 0
          ? new Set(selecRaw.filter((s): s is string => typeof s === "string"))
          : null;
      const filtradas =
        selecSet && selecSet.size > 0
          ? todasLinhas.filter((l) => selecSet.has(String(l.disciplina_slug)))
          : todasLinhas;
      // Se a seleção não casar com nenhuma linha, mantém todas (nunca cria obra sem EAP).
      const linhas = filtradas.length > 0 ? filtradas : todasLinhas;
      const { error: eapErr } = await supabase.from("hub_obra_frentes_eap").insert(linhas);
      if (eapErr) {
        avisoEap = "Obra criada; as frentes da EAP precisam da migração E0 aplicada.";
      } else {
        frentesCriadas = linhas.length;
      }
    } else {
      avisoEap = "Tipo sem preset — adicione frentes manualmente na EAP.";
    }
  } else {
    avisoEap = "Personalização de frentes ainda não ativa (migração E0 pendente).";
  }

  return NextResponse.json(
    { data: obra, frentes_criadas: frentesCriadas, aviso: avisoEap },
    { status: 201 }
  );
}
