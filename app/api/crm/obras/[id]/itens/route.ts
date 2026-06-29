/**
 * E2 — Itens × Subitens da obra (Situação auto × Andamento manual).
 *
 * SEGURANÇA (regra sistêmica E0/E1/A0): crmDb() é service-role e BYPASSA RLS — o isolamento
 * depende 100% do filtro no código. Toda query filtra `.eq("tenant_id", g.ctx.tenantId)` PURO
 * (nunca `.or('...is.null')`) E `.eq("obra_id", obraId)`. A obra é validada por posse (404 se
 * o tenant_id não bate). tenant_id vem SEMPRE da sessão (requireCrm*), nunca do body.
 *
 * TOLERÂNCIA: se a tabela/view ainda não existe (migração E2 pendente), devolve
 * { data: [], migracao_pendente: true, aviso } — a UI mostra aviso honesto, não quebra.
 *
 * Situação NUNCA é escrita (é derivada na vw_hub_obra_itens_situacao). O PATCH só toca
 * avanço/andamento/datas/bloqueios/evidência. A leitura usa a VIEW para trazer `situacao`.
 */

import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmComercial, requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { isMissingPgColumn } from "@/lib/tenant-default";
import { sessaoPodeEscreverCusto } from "@/lib/obras/persona-escopo";
import {
  isAndamentoItem,
  isSituacaoItem,
  isTipoItem,
  codigoItemFromNome,
  BLOQUEIOS,
} from "@/lib/obras/itens-situacao";

type Params = { params: Promise<{ id: string }> };

/** Colunas devolvidas (da view, que inclui i.* + situacao + dias_atraso). */
const SELECT_VIEW =
  "id, obra_id, frente_id, parent_id, codigo, nome, descricao, disciplina_slug, area_codigo, area_label, tipo, data_inicio, data_termino, pct_avanco, situacao_override, andamento, falta_pessoa, falta_documento, falta_material, falta_ferramenta, falta_equipamento, bloqueio_obs, quantidade, unidade, valor_contrato, responsavel_nome, tem_evidencia, evidencia_url, observacoes, peso, ordem, ativo, origem, situacao, dias_atraso";

/** E0.5 (aditivo): mesma view + as colunas ambiente/taxonomia_id (existem só após a migração E0.5). */
const SELECT_VIEW_E0B = `${SELECT_VIEW}, ambiente, taxonomia_id`;

/** Colunas da tabela base (sem os derivados da view) — usado no insert/update returning. */
const SELECT_BASE =
  "id, obra_id, frente_id, parent_id, codigo, nome, descricao, disciplina_slug, area_codigo, area_label, tipo, data_inicio, data_termino, pct_avanco, situacao_override, andamento, falta_pessoa, falta_documento, falta_material, falta_ferramenta, falta_equipamento, bloqueio_obs, quantidade, unidade, valor_contrato, responsavel_nome, tem_evidencia, evidencia_url, observacoes, peso, ordem, ativo, origem";

const AVISO_PENDENTE =
  "Itens & avanço ainda não ativos (migração E2 pendente — janela do dono).";

/**
 * E7 — campos de CUSTO gravados pelo editor de escopo (existem só após a migração E7).
 * `quantidade` é E2 (sempre existe) e é tratada à parte. bdi_fator é o override por item (E7).
 */
const CAMPOS_CUSTO_E7 = [
  "custo_locacao_frete",
  "custo_material",
  "custo_mao_obra",
  "bdi_fator",
] as const;

function ehTabelaAusente(error: { message?: string } | null): boolean {
  if (!error) return false;
  return isMissingPgColumn(error) || /relation .*does not exist/i.test(error.message ?? "");
}

/** Alguma das colunas E7 (custo/bdi) ainda não existe no schema (migração E7 pendente). */
function ehColunaE7Ausente(error: { message?: string } | null): boolean {
  if (!error) return false;
  return (
    isMissingPgColumn(error, "custo_locacao_frete") ||
    isMissingPgColumn(error, "custo_material") ||
    isMissingPgColumn(error, "custo_mao_obra") ||
    isMissingPgColumn(error, "bdi_fator")
  );
}

/**
 * Confirma que a obra pertence ao tenant do caller. crmDb() é service-role (RLS bypassada),
 * então a checagem explícita é a única proteção. tenant_id NULL não pertence a ninguém → 404.
 */
async function assertObraDoTenant(
  obraId: string,
  tenantId: string
): Promise<NextResponse | null> {
  const { data } = await crmDb()
    .from("hub_obras")
    .select("id, tenant_id")
    .eq("id", obraId)
    .maybeSingle();
  if (!data || data.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Obra não encontrada" }, { status: 404 });
  }
  return null;
}

export async function GET(request: NextRequest, { params }: Params) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id: obraId } = await params;
  const tenantErr = await assertObraDoTenant(obraId, g.ctx.tenantId);
  if (tenantErr) return tenantErr;

  const tenantId = g.ctx.tenantId;
  const url = new URL(request.url);
  const disciplina = url.searchParams.get("disciplina")?.trim() || "";
  const area = url.searchParams.get("area")?.trim() || "";
  const situacao = url.searchParams.get("situacao")?.trim() || "";

  const ambiente = url.searchParams.get("ambiente")?.trim() || "";

  // Monta a query com o select escolhido (extraído p/ poder repetir no retry sem colunas E0.5).
  // `comE0b` controla se as colunas E0.5 (ambiente) entram no select E no filtro — no retro-fallback
  // ambas saem juntas, senão filtrar por `ambiente` toparia de novo na coluna ausente.
  function montar(comE0b: boolean) {
    let q = crmDb()
      .from("vw_hub_obra_itens_situacao")
      .select(comE0b ? SELECT_VIEW_E0B : SELECT_VIEW)
      .eq("obra_id", obraId)
      .eq("tenant_id", tenantId) // defesa em profundidade (itens nunca são globais)
      .order("ordem", { ascending: true })
      .limit(1000);
    if (disciplina) q = q.eq("disciplina_slug", disciplina);
    if (area) q = q.eq("area_codigo", area);
    if (comE0b && ambiente) q = q.eq("ambiente", ambiente);
    if (situacao && isSituacaoItem(situacao)) q = q.eq("situacao", situacao);
    return q;
  }

  // Tenta com ambiente/taxonomia_id (E0.5). Se a coluna não existe (migração E0.5 pendente),
  // repete com o select base — a UI degrada o eixo "Ambiente" mas o resto segue idêntico.
  let { data, error } = await montar(true);
  if (error && (isMissingPgColumn(error, "ambiente") || isMissingPgColumn(error, "taxonomia_id"))) {
    ({ data, error } = await montar(false));
  }

  if (error) {
    if (ehTabelaAusente(error)) {
      return NextResponse.json({ data: [], migracao_pendente: true, aviso: AVISO_PENDENTE });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [], migracao_pendente: false });
}

/** POST = criar item (parent_id null) ou subitem (parent_id setado). Click-and-Go: código auto. */
export async function POST(request: NextRequest, { params }: Params) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id: obraId } = await params;
  const tenantErr = await assertObraDoTenant(obraId, g.ctx.tenantId);
  if (tenantErr) return tenantErr;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const nome = String(body.nome || "").trim();
  if (!nome) return NextResponse.json({ error: "Informe o nome do item." }, { status: 400 });

  const supabase = crmDb();

  // parent_id (subitem) — se vier, confirma que o pai é da mesma obra/tenant.
  const parentId = typeof body.parent_id === "string" && body.parent_id.trim() ? body.parent_id.trim() : null;
  if (parentId) {
    const { data: pai } = await supabase
      .from("hub_obra_itens")
      .select("id, obra_id, tenant_id")
      .eq("id", parentId)
      .maybeSingle();
    if (!pai || pai.obra_id !== obraId || pai.tenant_id !== g.ctx.tenantId) {
      return NextResponse.json({ error: "Item pai não encontrado nesta obra." }, { status: 404 });
    }
  }

  // Código único na obra (Click-and-Go: gera do nome, sufixa se colidir).
  const { data: existentes, error: errList } = await supabase
    .from("hub_obra_itens")
    .select("codigo, ordem")
    .eq("obra_id", obraId)
    .eq("tenant_id", g.ctx.tenantId);
  if (errList && ehTabelaAusente(errList)) {
    return NextResponse.json({ error: AVISO_PENDENTE, migracao_pendente: true }, { status: 503 });
  }
  const usados = new Set<string>((existentes ?? []).map((r) => String(r.codigo)));
  const maxOrdem = (existentes ?? []).reduce((m, r) => Math.max(m, Number(r.ordem ?? 0)), -1);

  let codigo = typeof body.codigo === "string" && body.codigo.trim()
    ? body.codigo.trim()
    : codigoItemFromNome(nome, typeof body.codigo_prefixo === "string" ? body.codigo_prefixo : undefined);
  const base = codigo;
  let n = 2;
  while (usados.has(codigo)) {
    codigo = `${base}-${n}`;
    n += 1;
  }

  const tipo = typeof body.tipo === "string" && isTipoItem(body.tipo) ? body.tipo : "contrato";
  const andamento =
    typeof body.andamento === "string" && isAndamentoItem(body.andamento) ? body.andamento : "nao_iniciado";

  const insert: Record<string, unknown> = {
    obra_id: obraId,
    tenant_id: g.ctx.tenantId,
    parent_id: parentId,
    frente_id: typeof body.frente_id === "string" && body.frente_id.trim() ? body.frente_id.trim() : null,
    codigo,
    nome,
    descricao: typeof body.descricao === "string" ? body.descricao.trim() || null : null,
    disciplina_slug: typeof body.disciplina_slug === "string" ? body.disciplina_slug.trim() || null : null,
    area_codigo: typeof body.area_codigo === "string" ? body.area_codigo.trim() || null : null,
    area_label: typeof body.area_label === "string" ? body.area_label.trim() || null : null,
    tipo,
    data_inicio: typeof body.data_inicio === "string" && body.data_inicio.trim() ? body.data_inicio.trim() : null,
    data_termino: typeof body.data_termino === "string" && body.data_termino.trim() ? body.data_termino.trim() : null,
    pct_avanco: typeof body.pct_avanco === "number" ? Math.max(0, Math.min(100, body.pct_avanco)) : 0,
    andamento,
    quantidade: typeof body.quantidade === "number" ? body.quantidade : null,
    unidade: typeof body.unidade === "string" ? body.unidade.trim() || null : null,
    valor_contrato: typeof body.valor_contrato === "number" ? body.valor_contrato : null,
    responsavel_nome: typeof body.responsavel_nome === "string" ? body.responsavel_nome.trim() || null : null,
    peso: typeof body.peso === "number" ? body.peso : 0,
    ordem: maxOrdem + 1,
    origem: "manual",
  };

  // E0.5 (aditivo): ambiente + taxonomia_id só entram se vierem no body. Em schema sem essas
  // colunas (migração E0.5 pendente), o insert falha com missing-column → retry sem elas (abaixo).
  // R3 (ESTRUTURA-UNIFICADA §7 Fase 0): CANONICALIZA `ambiente` (trim + lowercase) no write — sem
  // lista fechada — para "Sala"/"sala "/"SALA" agregarem no MESMO subtotal por ambiente (a fonte da
  // fragmentação dos subtotais). Toda escrita em hub_obra_itens.ambiente passa por aqui.
  const camposE0b: Record<string, unknown> = {};
  if (typeof body.ambiente === "string" && body.ambiente.trim()) {
    camposE0b.ambiente = body.ambiente.trim().toLowerCase();
  }
  if (typeof body.taxonomia_id === "string" && body.taxonomia_id.trim()) camposE0b.taxonomia_id = body.taxonomia_id.trim();

  let { data, error } = await supabase
    .from("hub_obra_itens")
    .insert({ ...insert, ...camposE0b })
    .select(SELECT_BASE)
    .single();
  // Retry sem os campos E0.5 quando a coluna não existe ainda (não bloqueia a criação do item).
  if (
    error &&
    Object.keys(camposE0b).length > 0 &&
    (isMissingPgColumn(error, "ambiente") || isMissingPgColumn(error, "taxonomia_id"))
  ) {
    ({ data, error } = await supabase
      .from("hub_obra_itens")
      .insert(insert)
      .select(SELECT_BASE)
      .single());
  }

  if (error) {
    if (ehTabelaAusente(error)) {
      return NextResponse.json({ error: AVISO_PENDENTE, migracao_pendente: true }, { status: 503 });
    }
    if (/duplicate key|unique/i.test(error.message)) {
      return NextResponse.json(
        { error: `Já existe um item com o código "${codigo}" nesta obra.` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}

/**
 * PATCH = atualizar avanço / andamento / datas / bloqueios / evidência de um item (por id).
 * Situação NÃO é aceita aqui (é derivada). situacao_override é aceito (aditivo de prazo).
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id: obraId } = await params;
  const tenantErr = await assertObraDoTenant(obraId, g.ctx.tenantId);
  if (tenantErr) return tenantErr;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const itemId = String(body.id || "").trim();
  if (!itemId) return NextResponse.json({ error: "id do item é obrigatório" }, { status: 400 });

  // GATE DE PERSONA (server-side): quem pode GRAVAR custo é derivado do PAPEL da sessão, não do
  // cliente. Arquiteto/prestador NÃO podem tocar a faixa-dinheiro — os campos de custo são
  // ignorados (silenciosamente) e a resposta sinaliza `custo_ignorado_persona`. NUNCA confiar no
  // cliente esconder o input. `quantidade` e avanço seguem permitidos para todas as personas.
  const podeCusto = sessaoPodeEscreverCusto(g.ctx.role);

  // `patch` = campos sempre-presentes (E2). `patchCusto` = campos E7 (custo/bdi), separados para o
  // retry tolerante: sem as colunas E7, gravamos só o `patch` (quantidade entra aí) — o custo não
  // grava mas a quantidade sim, e a resposta diz a verdade (migracao_pendente).
  const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  const patchCusto: Record<string, unknown> = {};

  // quantidade (E2, coluna sempre presente): aceita 0 como valor válido (item zerado), null limpa.
  if ("quantidade" in body) {
    const q = body.quantidade;
    if (q === null) patch.quantidade = null;
    else if (typeof q === "number" && Number.isFinite(q)) patch.quantidade = Math.max(0, q);
  }
  if ("unidade" in body) {
    patch.unidade = typeof body.unidade === "string" ? body.unidade.trim() || null : null;
  }

  // Custos E7 (locação/frete, material, mão de obra, bdi_fator do item): só se a persona pode.
  // Cada campo: number ≥ 0 (bdi pode ser >0); null limpa. Vão em `patchCusto` (retry tolerante).
  let custoRejeitadoPorPersona = false;
  for (const campo of CAMPOS_CUSTO_E7) {
    if (!(campo in body)) continue;
    if (!podeCusto) {
      custoRejeitadoPorPersona = true; // veio custo no body mas o papel não pode → ignora, sinaliza
      continue;
    }
    const v = body[campo];
    if (v === null) {
      patchCusto[campo] = null;
    } else if (typeof v === "number" && Number.isFinite(v)) {
      // bdi_fator é um fator (>0 faz sentido); custos não-negativos. Clampa o piso em 0.
      patchCusto[campo] = Math.max(0, v);
    }
  }

  if (typeof body.pct_avanco === "number") {
    patch.pct_avanco = Math.max(0, Math.min(100, body.pct_avanco));
  }
  if (typeof body.andamento === "string" && isAndamentoItem(body.andamento)) {
    patch.andamento = body.andamento;
  }
  if ("situacao_override" in body) {
    const so = body.situacao_override;
    if (so === null) patch.situacao_override = null;
    else if (typeof so === "string" && isSituacaoItem(so) && so !== "sem_data" && so !== "atencao") {
      patch.situacao_override = so; // só os 5 do CHECK da coluna (sem_data/atencao são só derivados)
    }
  }
  if ("data_inicio" in body) {
    patch.data_inicio = typeof body.data_inicio === "string" && body.data_inicio.trim() ? body.data_inicio.trim() : null;
  }
  if ("data_termino" in body) {
    patch.data_termino = typeof body.data_termino === "string" && body.data_termino.trim() ? body.data_termino.trim() : null;
  }
  if (typeof body.nome === "string" && body.nome.trim()) patch.nome = body.nome.trim();
  if ("descricao" in body) patch.descricao = typeof body.descricao === "string" ? body.descricao.trim() || null : null;
  if ("observacoes" in body) patch.observacoes = typeof body.observacoes === "string" ? body.observacoes.trim() || null : null;
  if ("bloqueio_obs" in body) patch.bloqueio_obs = typeof body.bloqueio_obs === "string" ? body.bloqueio_obs.trim() || null : null;
  if ("responsavel_nome" in body) patch.responsavel_nome = typeof body.responsavel_nome === "string" ? body.responsavel_nome.trim() || null : null;
  if ("evidencia_url" in body) {
    const url = typeof body.evidencia_url === "string" ? body.evidencia_url.trim() || null : null;
    patch.evidencia_url = url;
    patch.tem_evidencia = !!url;
  }
  if (typeof body.ativo === "boolean") patch.ativo = body.ativo;
  if (typeof body.ordem === "number") patch.ordem = body.ordem;
  if (typeof body.frente_id === "string") patch.frente_id = body.frente_id.trim() || null;
  // Os 5 bloqueios (booleans).
  for (const b of BLOQUEIOS) {
    if (typeof body[b.campo] === "boolean") patch[b.campo] = body[b.campo];
  }

  const temCusto = Object.keys(patchCusto).length > 0;
  const tenantId = g.ctx.tenantId; // capturado fora da closure (TS estreita o union do guard)

  // Update com os campos E7 inclusos (quando há custo a gravar e a persona pode).
  // O `.eq("id"/"obra_id"/"tenant_id")` é a ÚNICA proteção (service-role bypassa RLS): nunca
  // aceitamos tenant_id/obra_id/id do body — o filtro garante posse.
  function executar(comCusto: boolean) {
    const corpo = comCusto ? { ...patch, ...patchCusto } : patch;
    return crmDb()
      .from("hub_obra_itens")
      .update(corpo)
      .eq("id", itemId)
      .eq("obra_id", obraId) // garante que o item é da obra do tenant validado
      .eq("tenant_id", tenantId)
      .select(SELECT_BASE)
      .maybeSingle();
  }

  let { data, error } = await executar(temCusto);

  // TOLERÂNCIA E7: se o custo não pôde gravar porque a coluna não existe (migração E7 pendente),
  // repete SEM os campos de custo — a `quantidade`/avanço (E2) grava na mesma, e a resposta avisa
  // honestamente que o custo só entra após a migração (a UI não diz "salvou" o que não salvou).
  let custoPendenteMigracao = false;
  if (error && temCusto && ehColunaE7Ausente(error)) {
    custoPendenteMigracao = true;
    ({ data, error } = await executar(false));
  }

  if (error) {
    if (ehTabelaAusente(error)) {
      return NextResponse.json({ error: AVISO_PENDENTE, migracao_pendente: true }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });

  // Resposta honesta: avisa se o custo foi descartado por migração pendente OU por persona sem
  // permissão — a UI usa esses flags para NÃO mentir "salva automaticamente".
  return NextResponse.json({
    data,
    custo_gravado: temCusto && !custoPendenteMigracao,
    migracao_pendente: custoPendenteMigracao,
    custo_ignorado_persona: custoRejeitadoPorPersona,
    ...(custoPendenteMigracao
      ? { aviso: "Quantidade salva. Custo/preço disponível após aplicar a migração E7 (janela do dono)." }
      : {}),
  });
}
