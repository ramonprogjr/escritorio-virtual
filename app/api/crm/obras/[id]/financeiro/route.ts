/**
 * E6 — Financeiro da obra: orçamento (Gate 1) · pagamentos (Gate 2 duplo) · escrow · compatibilização.
 *
 * SEGURANÇA (regra sistêmica E0/E2/E3/E5): crmDb() é service-role e BYPASSA RLS — o isolamento depende
 * 100% do filtro no código. Toda query filtra `.eq("tenant_id", g.ctx.tenantId)` PURO E `.eq("obra_id")`.
 * A obra é validada por POSSE (404 se o tenant não bate). tenant_id vem SEMPRE da sessão, nunca do body.
 *
 * BIFURCAÇÃO POR tipo_contrato NA APRESENTAÇÃO: administracao expõe valor_unitario; preco_fechado NÃO
 * seleciona valor_unitario/composição (DEFESA NA QUERY — a composição é da executante, nunca ao cliente).
 *
 * HUMANO APROVA O DINHEIRO: este endpoint PREPARA (cria orçamento em rascunho/enviado, pagamento bloqueado).
 * Aprovar é o gate dourado (fila /crm/aprovacoes) + a cascata em /api/aprovacoes/[id]. A IA nunca aprova.
 *
 * TOLERÂNCIA: tabela ausente (migração E6 pendente) → GET { migracao_pendente: true } com baldes vazios;
 * POST → 503 honesto. Nunca quebra.
 */

import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmComercial, requireCrmFinanceiro, requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { isMissingPgColumn } from "@/lib/tenant-default";
import {
  isTipoContrato,
  isTipoPagamento,
  resumoFinanceiroVazio,
  baldePagamento,
  type TipoContrato,
  type ResumoFinanceiro,
} from "@/lib/obras/financeiro";

type Params = { params: Promise<{ id: string }> };

const AVISO_PENDENTE = "Financeiro ainda não ativo (migração E6 pendente — janela do dono).";

function ehTabelaAusente(error: { message?: string } | null): boolean {
  if (!error) return false;
  return isMissingPgColumn(error) || /relation .*does not exist|column .* does not exist/i.test(error.message ?? "");
}

/** Posse da obra + tipo_contrato (a obra é a fonte do eixo). 404 se o tenant não bate. */
async function carregarObra(
  obraId: string,
  tenantId: string
): Promise<{ tipo_contrato: TipoContrato } | { erro: NextResponse }> {
  const { data } = await crmDb()
    .from("hub_obras")
    .select("id, tenant_id, tipo_contrato")
    .eq("id", obraId)
    .maybeSingle();
  if (!data || data.tenant_id !== tenantId) {
    return { erro: NextResponse.json({ error: "Obra não encontrada" }, { status: 404 }) };
  }
  const tipo = typeof data.tipo_contrato === "string" && isTipoContrato(data.tipo_contrato)
    ? data.tipo_contrato
    : "administracao"; // default tolerante (coluna pode não existir antes da migração)
  return { tipo_contrato: tipo };
}

/** GET = resumo + orçamentos (bifurcado) + pagamentos + cobertura. */
export async function GET(request: NextRequest, { params }: Params) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id: obraId } = await params;
  const obra = await carregarObra(obraId, g.ctx.tenantId);
  if ("erro" in obra) return obra.erro;
  const tipoContrato = obra.tipo_contrato;
  const tenantId = g.ctx.tenantId;
  const supabase = crmDb();
  const hojeISO = new Date().toISOString().slice(0, 10);

  // ── Orçamentos da obra. No preço fechado o SELECT dos ITENS não traz valor_unitario/composição. ──
  const { data: orcamentos, error: errOrc } = await supabase
    .from("hub_obra_orcamentos")
    .select("id, frente_id, titulo, descricao, versao, valor_total, status, escrow_status, aprovado_em, criado_em")
    .eq("obra_id", obraId)
    .eq("tenant_id", tenantId)
    .order("criado_em", { ascending: false })
    .limit(200);

  if (errOrc) {
    if (ehTabelaAusente(errOrc)) {
      return NextResponse.json({
        migracao_pendente: true,
        aviso: AVISO_PENDENTE,
        tipo_contrato: tipoContrato,
        resumo: resumoFinanceiroVazio(),
        orcamentos: [],
        pagamentos: [],
        cobertura: [],
      });
    }
    return NextResponse.json({ error: errOrc.message }, { status: 500 });
  }

  const orcamentoIds = (orcamentos ?? []).map((o) => String(o.id));

  // Itens dos orçamentos. DEFESA NA QUERY: preço fechado não seleciona valor_unitario nem composição.
  const SELECT_ITEM_ADM =
    "id, orcamento_id, item_id, descricao, unidade, quantidade, valor_unitario, valor_total, spread_pct, visivel_cliente, ordem";
  const SELECT_ITEM_FECHADO = "id, orcamento_id, item_id, descricao, valor_total, visivel_cliente, ordem";
  let itensPorOrcamento = new Map<string, unknown[]>();
  if (orcamentoIds.length > 0) {
    // Select condicional (defesa na query: preço fechado não traz valor_unitario). O cast por `unknown`
    // evita o parser de tipos do PostgREST quebrar com string dinâmica — a forma é validada em runtime.
    const selectItens = tipoContrato === "administracao" ? SELECT_ITEM_ADM : SELECT_ITEM_FECHADO;
    const { data: itens } = await supabase
      .from("hub_obra_orcamento_itens")
      .select(selectItens as string)
      .in("orcamento_id", orcamentoIds)
      .eq("tenant_id", tenantId)
      .order("ordem", { ascending: true });
    const itensRows = (itens ?? []) as unknown as Array<Record<string, unknown>>;
    itensPorOrcamento = new Map();
    for (const it of itensRows) {
      const key = String(it.orcamento_id);
      const arr = itensPorOrcamento.get(key) ?? [];
      arr.push(it);
      itensPorOrcamento.set(key, arr);
    }
  }

  const orcamentosOut = (orcamentos ?? []).map((o) => ({
    ...o,
    itens: itensPorOrcamento.get(String(o.id)) ?? [],
  }));

  // ── Pagamentos da obra (com estado escrow + dupla aprovação). ──
  const { data: pagamentos } = await supabase
    .from("hub_obra_pagamentos")
    .select(
      "id, orcamento_id, item_id, titulo, tipo, numero_medicao, valor, valor_retencao, valor_liquido, valor_pago, data_vencimento, data_pagamento, status, aprovacao_arq_id, aprovacao_hub_id, escrow_liberado, fornecedor_nome, criado_em"
    )
    .eq("obra_id", obraId)
    .eq("tenant_id", tenantId)
    .order("data_vencimento", { ascending: true })
    .limit(300);

  // A2: estado REAL da dupla chave. Sem isto a pill deriva 'pendente' fixo (não mostra "em qual porta está").
  // Coleta os status das aprovações vinculadas (arq + hub) — escopado por tenant (defesa em profundidade).
  const aprovacaoIds = new Set<string>();
  for (const p of pagamentos ?? []) {
    if (p.aprovacao_arq_id) aprovacaoIds.add(String(p.aprovacao_arq_id));
    if (p.aprovacao_hub_id) aprovacaoIds.add(String(p.aprovacao_hub_id));
  }
  const statusPorAprovacao = new Map<string, string>();
  if (aprovacaoIds.size > 0) {
    const { data: aprs } = await supabase
      .from("hub_aprovacoes")
      .select("id, status")
      .in("id", [...aprovacaoIds])
      .eq("tenant_id", tenantId);
    for (const a of aprs ?? []) statusPorAprovacao.set(String(a.id), String(a.status));
  }

  const pagamentosOut = (pagamentos ?? []).map((p) => ({
    ...p,
    balde: baldePagamento(String(p.status), p.data_vencimento as string | null, hojeISO),
    // null = registro de aprovação ainda não criado (fila não enfileirada); a UI trata como pendente.
    aprovacao_arq_status: p.aprovacao_arq_id ? statusPorAprovacao.get(String(p.aprovacao_arq_id)) ?? null : null,
    aprovacao_hub_status: p.aprovacao_hub_id ? statusPorAprovacao.get(String(p.aprovacao_hub_id)) ?? null : null,
  }));

  // ── Cobertura (compatibilização) — só administração (item a item). ──
  let cobertura: unknown[] = [];
  if (tipoContrato === "administracao") {
    const { data: cov } = await supabase
      .from("vw_hub_obra_compatibilizacao")
      .select("item_id, codigo, nome, disciplina_slug, area_label, valor_contrato, orcado_aprovado, orcado_pendente, total_pago, estado_cobertura, pct_cobertura, eh_aditivo")
      .eq("obra_id", obraId)
      .eq("tenant_id", tenantId)
      .limit(500);
    cobertura = cov ?? [];
  }

  // ── Escrow (custódia) da obra. ──
  const { data: contaEscrow } = await supabase
    .from("hub_obra_escrow_contas")
    .select("id, saldo_custodia, saldo_liberado, saldo_pago, provedor")
    .eq("obra_id", obraId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  let movimentos: unknown[] = [];
  if (contaEscrow?.id) {
    const { data: movs } = await supabase
      .from("hub_obra_escrow_movimentos")
      .select("id, tipo, valor, pagamento_id, origem, criado_em")
      .eq("obra_id", obraId)
      .eq("tenant_id", tenantId)
      .order("criado_em", { ascending: false })
      .limit(50);
    movimentos = movs ?? [];
  }

  // ── Previsto = soma do valor_contrato dos itens de escopo da obra (E2). ANTES ficava R$ 0
  //    (montarResumo nunca somava o previsto). Tolerante: se hub_obra_itens não existir (E2
  //    pendente) ou nenhum item tiver valor_contrato, previsto = 0 (honesto, sem quebrar). ──
  const { data: itensObra } = await supabase
    .from("hub_obra_itens")
    .select("valor_contrato")
    .eq("obra_id", obraId)
    .eq("tenant_id", tenantId);
  const previsto = (itensObra ?? []).reduce((acc, it) => {
    const v = Number((it as Record<string, unknown>).valor_contrato ?? 0);
    return acc + (Number.isFinite(v) ? v : 0);
  }, 0);

  // ── Resumo (cabeçalho). previsto = soma valor_contrato dos itens-pai (E2). ──
  const resumo = montarResumo(orcamentos ?? [], pagamentosOut, contaEscrow, previsto, hojeISO);

  return NextResponse.json({
    migracao_pendente: false,
    tipo_contrato: tipoContrato,
    resumo,
    orcamentos: orcamentosOut,
    pagamentos: pagamentosOut,
    cobertura,
    escrow: contaEscrow ?? null,
    escrow_movimentos: movimentos,
  });
}

type PagamentoOut = {
  status: string;
  valor: number | null;
  valor_retencao: number | null;
  valor_liquido: number | null;
  escrow_liberado: boolean | null;
  data_vencimento: string | null;
  balde: string;
};

function montarResumo(
  orcamentos: Array<Record<string, unknown>>,
  pagamentos: PagamentoOut[],
  conta: { saldo_custodia?: number | null; saldo_liberado?: number | null } | null,
  previstoItens: number,
  _hojeISO: string
): ResumoFinanceiro {
  const r = resumoFinanceiroVazio();
  r.previsto = Number.isFinite(previstoItens) ? previstoItens : 0;
  for (const o of orcamentos) {
    const v = Number(o.valor_total ?? 0);
    if (String(o.status) !== "cancelado") r.orcado += Number.isFinite(v) ? v : 0;
    if (String(o.status) === "aprovado") r.aprovado += Number.isFinite(v) ? v : 0;
  }
  for (const p of pagamentos) {
    const liq = Number(p.valor_liquido ?? (Number(p.valor ?? 0) - Number(p.valor_retencao ?? 0)));
    const valor = Number.isFinite(liq) ? liq : 0;
    if (p.balde === "a_pagar") r.a_pagar += valor;
    else if (p.balde === "vencendo_7d") r.vencendo_7d += valor;
    else if (p.balde === "atrasado") r.atrasado += valor;
    if (p.status === "liberado" && !p.escrow_liberado) r.aguarda_2a_chave += valor;
  }
  r.em_custodia = Number(conta?.saldo_custodia ?? 0);
  r.liberado = Number(conta?.saldo_liberado ?? 0);
  return r;
}

type OrcamentoItemEntrada = {
  item_id?: string | null;
  descricao?: string;
  unidade?: string | null;
  quantidade?: number;
  valor_unitario?: number;
  valor_total?: number; // preço fechado: total direto
  spread_pct?: number;
  visivel_cliente?: boolean;
};

/**
 * POST = cria orçamento (Gate 1) OU pagamento (Gate 2) em estado de PREPARO.
 * - acao="orcamento": cria orçamento em 'rascunho'/'enviado' (NUNCA 'aprovado' — aprovar é o gate dourado).
 * - acao="pagamento": cria pagamento em 'bloqueado' (libera só quando o orçamento da frente for aprovado),
 *   exceto adiantamento (exige justificativa) e avulso (sem escrow).
 */
export async function POST(request: NextRequest, { params }: Params) {
  const g = await requireCrmFinanceiro(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id: obraId } = await params;
  const obra = await carregarObra(obraId, g.ctx.tenantId);
  if ("erro" in obra) return obra.erro;
  const tipoContrato = obra.tipo_contrato;
  const tenantId = g.ctx.tenantId;
  const supabase = crmDb();

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const acao = typeof body.acao === "string" ? body.acao.trim() : "orcamento";

  if (acao === "orcamento") {
    return criarOrcamento(supabase, obraId, tenantId, tipoContrato, body, g.ctx.userId);
  }
  if (acao === "pagamento") {
    return criarPagamento(supabase, obraId, tenantId, tipoContrato, body, g.ctx.userId);
  }
  return NextResponse.json({ error: "acao inválida (orcamento | pagamento)." }, { status: 400 });
}

async function criarOrcamento(
  supabase: ReturnType<typeof crmDb>,
  obraId: string,
  tenantId: string,
  tipoContrato: TipoContrato,
  body: Record<string, unknown>,
  userId: string
): Promise<NextResponse> {
  const titulo = typeof body.titulo === "string" ? body.titulo.trim() : "";
  if (!titulo) return NextResponse.json({ error: "Informe o título do orçamento." }, { status: 400 });

  const itensRaw = Array.isArray(body.itens) ? (body.itens as OrcamentoItemEntrada[]) : [];

  // R2 (ESTRUTURA-UNIFICADA §7 Fase 0): todo item de orçamento NASCE ligado ao item de escopo (E2).
  // Sem `item_id`, a linha some da vw_hub_obra_compatibilizacao (`WHERE oi.item_id IS NOT NULL`) e o
  // gate de cobertura mente para o gestor (bug em produção). Falha cedo, clara: qualquer linha com
  // descrição mas sem item_id válido → 400. (Linha sem descrição é ignorada adiante, como antes.)
  const temLinhaSemItem = itensRaw.some((i) => {
    const desc = (i.descricao ?? "").trim();
    const itemId = typeof i.item_id === "string" ? i.item_id.trim() : "";
    return desc.length > 0 && itemId.length === 0;
  });
  if (temLinhaSemItem) {
    return NextResponse.json(
      {
        error: "Selecione o item de escopo antes de lançar custo.",
        codigo: "item_escopo_obrigatorio",
      },
      { status: 400 }
    );
  }

  // Status do caller é restrito a rascunho/enviado — aprovar é gate humano (cascata de aprovação).
  const statusEntrada = typeof body.status === "string" ? body.status.trim() : "rascunho";
  const status = statusEntrada === "enviado" ? "enviado" : "rascunho";

  // valor_total: administração = soma dos itens; preço fechado = lump sum (valor_total do body).
  let valorTotal = 0;
  if (tipoContrato === "administracao") {
    valorTotal = itensRaw.reduce((acc, i) => {
      const q = Number(i.quantidade) || 0;
      const u = Number(i.valor_unitario) || 0;
      return acc + q * u;
    }, 0);
  } else {
    valorTotal = Number(body.valor_total) || itensRaw.reduce((acc, i) => acc + (Number(i.valor_total) || 0), 0);
  }

  const insertOrc: Record<string, unknown> = {
    obra_id: obraId,
    tenant_id: tenantId,
    frente_id: typeof body.frente_id === "string" && body.frente_id.trim() ? body.frente_id.trim() : null,
    titulo,
    descricao: typeof body.descricao === "string" ? body.descricao.trim() || null : null,
    valor_total: valorTotal,
    status,
    escrow_status: "sem_custodia",
    criado_por: userId,
  };

  const { data: orc, error: errOrc } = await supabase
    .from("hub_obra_orcamentos")
    .insert(insertOrc)
    .select("id, titulo, valor_total, status")
    .single();

  if (errOrc) {
    if (ehTabelaAusente(errOrc)) {
      return NextResponse.json({ error: AVISO_PENDENTE, migracao_pendente: true }, { status: 503 });
    }
    return NextResponse.json({ error: errOrc.message }, { status: 500 });
  }

  // Itens estruturados. No preço fechado, valor_unitario/composição podem vir mas a apresentação ao
  // cliente é filtrada no GET; aqui gravamos o que veio (auditável pelo Hub).
  if (itensRaw.length > 0) {
    const rows = itensRaw
      .map((i, idx) => {
        const desc = (i.descricao ?? "").trim();
        if (!desc) return null;
        const row: Record<string, unknown> = {
          orcamento_id: String(orc.id),
          obra_id: obraId,
          tenant_id: tenantId,
          item_id: typeof i.item_id === "string" && i.item_id.trim() ? i.item_id.trim() : null,
          descricao: desc.slice(0, 240),
          ordem: idx,
          visivel_cliente: i.visivel_cliente !== false,
        };
        if (tipoContrato === "administracao") {
          row.unidade = i.unidade ?? null;
          row.quantidade = Number(i.quantidade) || 1;
          row.valor_unitario = Number(i.valor_unitario) || 0;
          row.spread_pct = Number(i.spread_pct) || 0;
        } else {
          // Preço fechado: total direto por linha; valor_unitario fica em 0 (não exibido).
          row.quantidade = 1;
          row.valor_unitario = Number(i.valor_total) || 0;
        }
        return row;
      })
      .filter((r): r is Record<string, unknown> => r !== null);

    if (rows.length > 0) {
      const { error: errItens } = await supabase.from("hub_obra_orcamento_itens").insert(rows);
      if (errItens && !ehTabelaAusente(errItens)) {
        return NextResponse.json({ error: errItens.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ data: orc }, { status: 201 });
}

async function criarPagamento(
  supabase: ReturnType<typeof crmDb>,
  obraId: string,
  tenantId: string,
  tipoContrato: TipoContrato,
  body: Record<string, unknown>,
  userId: string
): Promise<NextResponse> {
  const titulo = typeof body.titulo === "string" ? body.titulo.trim() : "";
  if (!titulo) return NextResponse.json({ error: "Informe o título do pagamento." }, { status: 400 });

  const tipo = typeof body.tipo === "string" && isTipoPagamento(body.tipo) ? body.tipo : "medicao";
  const valor = Number(body.valor);
  if (!Number.isFinite(valor) || valor <= 0) {
    return NextResponse.json({ error: "Informe um valor positivo." }, { status: 400 });
  }
  const dataVencimento = typeof body.data_vencimento === "string" ? body.data_vencimento.trim() : "";
  if (!dataVencimento) {
    return NextResponse.json({ error: "Informe a data de vencimento." }, { status: 400 });
  }

  const orcamentoId =
    typeof body.orcamento_id === "string" && body.orcamento_id.trim() ? body.orcamento_id.trim() : null;
  const justificativa =
    typeof body.adiantamento_justificativa === "string" ? body.adiantamento_justificativa.trim() : "";

  // Adiantamento exige justificativa (espelha o CHECK do banco; falha cedo com mensagem clara).
  if (tipo === "adiantamento" && !justificativa) {
    return NextResponse.json(
      { error: "adiantamento_exige_justificativa", detalhe: "Adiantamento sem orçamento exige justificativa explícita." },
      { status: 422 }
    );
  }

  // Medição/aditivo/retenção precisam de orçamento APROVADO (senão nasce bloqueado pelo design).
  // avulso/reembolso são "sem escrow" (não exigem orçamento) — honestidade.
  let statusInicial = "bloqueado";
  if (orcamentoId) {
    const { data: orc } = await supabase
      .from("hub_obra_orcamentos")
      .select("id, status")
      .eq("id", orcamentoId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (orc && orc.status === "aprovado") statusInicial = "liberado";
  } else if (tipo === "avulso" || tipo === "reembolso" || tipo === "adiantamento") {
    // sem escrow / adiantamento justificado → já liberado para o gate humano.
    statusInicial = "liberado";
  }

  const insertPag: Record<string, unknown> = {
    obra_id: obraId,
    tenant_id: tenantId,
    orcamento_id: orcamentoId,
    item_id: typeof body.item_id === "string" && body.item_id.trim() ? body.item_id.trim() : null,
    titulo: titulo.slice(0, 240),
    tipo,
    numero_medicao: Number.isFinite(Number(body.numero_medicao)) ? Number(body.numero_medicao) : null,
    valor,
    valor_retencao: Number(body.valor_retencao) || 0,
    data_vencimento: dataVencimento,
    status: statusInicial,
    tipo_contrato: tipoContrato,
    adiantamento_justificativa: tipo === "adiantamento" ? justificativa : null,
    fornecedor_nome: typeof body.fornecedor_nome === "string" ? body.fornecedor_nome.trim() || null : null,
    criado_por: userId,
  };

  const { data: pag, error: errPag } = await supabase
    .from("hub_obra_pagamentos")
    .insert(insertPag)
    .select("id, titulo, valor, status, data_vencimento")
    .single();

  if (errPag) {
    if (ehTabelaAusente(errPag)) {
      return NextResponse.json({ error: AVISO_PENDENTE, migracao_pendente: true }, { status: 503 });
    }
    return NextResponse.json({ error: errPag.message }, { status: 500 });
  }

  return NextResponse.json({ data: pag }, { status: 201 });
}

/** PATCH = ações de preparo do humano (enviar orçamento, enfileirar as 2 chaves, cancelar). */
export async function PATCH(request: NextRequest, { params }: Params) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id: obraId } = await params;
  const obra = await carregarObra(obraId, g.ctx.tenantId);
  if ("erro" in obra) return obra.erro;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const acao = typeof body.acao === "string" ? body.acao.trim() : "";
  const tenantId = g.ctx.tenantId;
  const supabase = crmDb();

  // Enfileirar o Gate 1 (orçamento da frente) na fila dourada — cria o registro tipado em hub_aprovacoes.
  if (acao === "enviar_orcamento") {
    const orcamentoId = typeof body.orcamento_id === "string" ? body.orcamento_id.trim() : "";
    if (!orcamentoId) return NextResponse.json({ error: "orcamento_id ausente" }, { status: 400 });

    const { data: orc } = await supabase
      .from("hub_obra_orcamentos")
      .select("id, titulo, valor_total, status")
      .eq("id", orcamentoId)
      .eq("obra_id", obraId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!orc) return NextResponse.json({ error: "Orçamento não encontrado" }, { status: 404 });
    if (orc.status === "aprovado") {
      return NextResponse.json({ error: "Orçamento já aprovado." }, { status: 422 });
    }

    const { data: apr, error: errApr } = await supabase
      .from("hub_aprovacoes")
      .insert({
        tipo: "orcamento_frente",
        titulo: `Orçamento: ${orc.titulo}`,
        descricao: `Aprovar o orçamento da frente libera os pagamentos vinculados.`,
        valor: orc.valor_total,
        valor_envolvido: orc.valor_total,
        status: "pendente",
        tenant_id: tenantId,
        obra_id: obraId,
        referencia_id: orcamentoId,
        solicitado_por: g.ctx.userId,
        dados: { orcamento_id: orcamentoId, obra_id: obraId },
      })
      .select("id")
      .single();
    if (errApr) {
      if (ehTabelaAusente(errApr)) {
        return NextResponse.json({ error: AVISO_PENDENTE, migracao_pendente: true }, { status: 503 });
      }
      return NextResponse.json({ error: errApr.message }, { status: 500 });
    }

    await supabase
      .from("hub_obra_orcamentos")
      .update({ status: "enviado", aprovacao_id: apr.id })
      .eq("id", orcamentoId)
      .eq("tenant_id", tenantId);

    return NextResponse.json({ ok: true, aprovacao_id: apr.id });
  }

  // Enfileirar o Gate 2 DUPLO (pagamento): cria DOIS registros tipados (arq + hub) na fila dourada.
  if (acao === "enviar_pagamento") {
    const pagamentoId = typeof body.pagamento_id === "string" ? body.pagamento_id.trim() : "";
    if (!pagamentoId) return NextResponse.json({ error: "pagamento_id ausente" }, { status: 400 });

    const { data: pag } = await supabase
      .from("hub_obra_pagamentos")
      .select("id, titulo, valor_liquido, valor, status, aprovacao_arq_id, aprovacao_hub_id")
      .eq("id", pagamentoId)
      .eq("obra_id", obraId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!pag) return NextResponse.json({ error: "Pagamento não encontrado" }, { status: 404 });
    if (pag.status === "bloqueado") {
      return NextResponse.json(
        { error: "orcamento_nao_aprovado", detalhe: "O orçamento da frente ainda não foi aprovado." },
        { status: 422 }
      );
    }
    if (pag.aprovacao_arq_id && pag.aprovacao_hub_id) {
      return NextResponse.json({ ok: true, idempotente: true });
    }

    const valor = Number(pag.valor_liquido ?? pag.valor ?? 0);
    const base = {
      titulo: `Pagamento: ${pag.titulo}`,
      valor,
      valor_envolvido: valor,
      status: "pendente",
      tenant_id: tenantId,
      obra_id: obraId,
      referencia_id: pagamentoId,
      solicitado_por: g.ctx.userId,
    };

    const { data: aprArq, error: e1 } = await supabase
      .from("hub_aprovacoes")
      .insert({ ...base, tipo: "pagamento_obra_arq", descricao: "Aprovação da ARQUITETURA (chave 1 de 2).", dados: { pagamento_id: pagamentoId, obra_id: obraId, papel: "arquitetura" } })
      .select("id")
      .single();
    if (e1) {
      if (ehTabelaAusente(e1)) return NextResponse.json({ error: AVISO_PENDENTE, migracao_pendente: true }, { status: 503 });
      return NextResponse.json({ error: e1.message }, { status: 500 });
    }
    const { data: aprHub, error: e2 } = await supabase
      .from("hub_aprovacoes")
      .insert({ ...base, tipo: "pagamento_obra_hub", descricao: "Aprovação do HUB (chave 2 de 2 — o juiz).", dados: { pagamento_id: pagamentoId, obra_id: obraId, papel: "hub" } })
      .select("id")
      .single();
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

    await supabase
      .from("hub_obra_pagamentos")
      .update({ aprovacao_arq_id: aprArq.id, aprovacao_hub_id: aprHub.id })
      .eq("id", pagamentoId)
      .eq("tenant_id", tenantId);

    return NextResponse.json({ ok: true, aprovacao_arq_id: aprArq.id, aprovacao_hub_id: aprHub.id });
  }

  // Cancelar (soft-delete: status, nunca DELETE).
  if (acao === "cancelar_orcamento" || acao === "cancelar_pagamento") {
    const tabela = acao === "cancelar_orcamento" ? "hub_obra_orcamentos" : "hub_obra_pagamentos";
    const campo = acao === "cancelar_orcamento" ? "orcamento_id" : "pagamento_id";
    const alvoId = typeof body[campo] === "string" ? String(body[campo]).trim() : "";
    if (!alvoId) return NextResponse.json({ error: `${campo} ausente` }, { status: 400 });
    const { error } = await supabase
      .from(tabela)
      .update({ status: "cancelado" })
      .eq("id", alvoId)
      .eq("obra_id", obraId)
      .eq("tenant_id", tenantId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "acao inválida." }, { status: 400 });
}
