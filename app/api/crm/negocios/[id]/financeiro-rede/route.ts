/**
 * Financeiro de REDE do negocio — a ponte das telas do dinheiro com o motor de comissoes.
 *
 * GET  = split/comissoes/titulos (a pagar/receber por participante) + extrato + participantes
 *        (para a "faixa de split na cara" e o "Meu Dinheiro").
 * POST = acoes de dinheiro, cada uma um RPC TESTADO (SECURITY DEFINER, fail-closed):
 *        - apurar : congela o split confirmado pelo humano (rpc_apurar_comissoes)
 *        - receber: cliente pagou -> comissao vira exigivel pro-rata (rpc_registrar_recebimento_negocio)
 *        - liberar: 2 chaves aprovadas -> autoriza o pagamento (rpc_liberar_pagamento_comissao)
 *
 * SEGURANCA: crmDb() e service_role (bypassa RLS) — o isolamento e o filtro no codigo. O negocio e
 * validado por POSSE (404 se o tenant nao bate). tenant_id/criado_por vem SEMPRE da sessao, nunca do body.
 * TOLERANCIA: sem as tabelas do motor (migracao pendente) -> GET degrada honesto; POST -> 503.
 */
import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmSessao, requireCrmFinanceiro } from "@/lib/crm/crm-api-auth";
import { isMissingPgColumn } from "@/lib/tenant-default";

type Params = { params: Promise<{ id: string }> };

function ehTabelaAusente(error: { message?: string } | null): boolean {
  if (!error) return false;
  return isMissingPgColumn(error) || /relation .*does not exist/i.test(error.message ?? "");
}

/** Posse do negocio. 404 se o tenant nao bate (service_role bypassa RLS). */
async function carregarNegocioDoTenant(id: string, tenantId: string) {
  const { data } = await crmDb()
    .from("hub_negocios")
    .select("id, tenant_id, titulo, status, valor_estimado, valor_fechado, percentual_comissao, comissao_calculada")
    .eq("id", id)
    .maybeSingle();
  if (!data || (data.tenant_id && data.tenant_id !== tenantId)) return null;
  return data;
}

export async function GET(request: NextRequest, { params }: Params) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  const tenantId = g.ctx.tenantId;
  const negocio = await carregarNegocioDoTenant(id, tenantId);
  if (!negocio) return NextResponse.json({ error: "Negócio não encontrado" }, { status: 404 });

  const db = crmDb();
  // Participantes ja vinculados (a fonte do split, Click-and-Go) — sempre existe.
  const { data: participantes } = await db
    .from("hub_negocio_vinculos")
    .select("id, entidade_tipo, entidade_id, papel")
    .eq("negocio_id", id)
    .eq("tenant_id", tenantId);

  // Motor de comissoes (tabelas novas). Tolerante: sem elas, retorna vazio + aviso.
  const [comissoes, titulos, movimentos] = await Promise.all([
    db.from("hub_comissoes").select("*").eq("negocio_id", id).eq("tenant_id", tenantId).order("criado_em", { ascending: true }),
    db.from("hub_negocio_titulos").select("*").eq("negocio_id", id).eq("tenant_id", tenantId).order("criado_em", { ascending: true }),
    db.from("hub_negocio_fin_movimentos").select("*").eq("negocio_id", id).eq("tenant_id", tenantId).order("criado_em", { ascending: false }).limit(100),
  ]);

  const motorPendente = ehTabelaAusente(comissoes.error) || ehTabelaAusente(titulos.error);

  // Pote previsto (base do split): valor_fechado x percentual_comissao (ou o estimado antes de fechar).
  const base = Number(negocio.valor_fechado ?? negocio.valor_estimado ?? 0);
  const pct = Number(negocio.percentual_comissao ?? 0);
  const pote_previsto = Math.round(base * pct) / 100;

  return NextResponse.json({
    negocio: {
      id: negocio.id,
      titulo: negocio.titulo,
      status: negocio.status,
      valor_estimado: negocio.valor_estimado,
      valor_fechado: negocio.valor_fechado,
      percentual_comissao: negocio.percentual_comissao,
      pote_previsto,
      apurado: (comissoes.data ?? []).length > 0,
    },
    participantes: participantes ?? [],
    comissoes: comissoes.data ?? [],
    titulos: titulos.data ?? [],
    movimentos: movimentos.data ?? [],
    motor_pendente: motorPendente,
    ...(motorPendente ? { aviso: "Motor de comissões ainda não ativo (migração pendente)." } : {}),
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const g = await requireCrmFinanceiro(request);
  if ("error" in g) return g.error;
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  const tenantId = g.ctx.tenantId;
  const negocio = await carregarNegocioDoTenant(id, tenantId);
  if (!negocio) return NextResponse.json({ error: "Negócio não encontrado" }, { status: 404 });

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const acao = typeof body.acao === "string" ? body.acao.trim() : "";
  const db = crmDb();
  const userId = g.ctx.userId ?? null;

  // APURAR: congela o split que o humano confirmou.
  if (acao === "apurar") {
    const valorFechado = Number(body.valor_fechado);
    if (!Number.isFinite(valorFechado) || valorFechado <= 0) {
      return NextResponse.json({ error: "Informe o valor fechado do negócio." }, { status: 400 });
    }
    const fatias = Array.isArray(body.fatias) ? body.fatias : [];
    const { data, error } = await db.rpc("rpc_apurar_comissoes", {
      p_negocio_id: id,
      p_tenant_id: tenantId,
      p_valor_fechado: valorFechado,
      p_fatias: fatias,
      p_criado_por: userId,
    });
    if (error) {
      if (ehTabelaAusente(error)) return NextResponse.json({ error: "Motor de comissões pendente (migração)." }, { status: 503 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  }

  // RECEBER: cliente pagou -> comissao exigivel pro-rata.
  if (acao === "receber") {
    const valor = Number(body.valor);
    if (!Number.isFinite(valor) || valor <= 0) {
      return NextResponse.json({ error: "Informe o valor recebido." }, { status: 400 });
    }
    const { data, error } = await db.rpc("rpc_registrar_recebimento_negocio", {
      p_negocio_id: id,
      p_tenant_id: tenantId,
      p_valor: valor,
      p_criado_por: userId,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // LIBERAR: 2 chaves aprovadas -> autoriza o pagamento de um titulo.
  if (acao === "liberar") {
    const tituloId = typeof body.titulo_id === "string" ? body.titulo_id.trim() : "";
    if (!tituloId) return NextResponse.json({ error: "titulo_id ausente." }, { status: 400 });
    const { data, error } = await db.rpc("rpc_liberar_pagamento_comissao", {
      p_titulo_id: tituloId,
      p_tenant_id: tenantId,
      p_criado_por: userId,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: "ação inválida (apurar | receber | liberar)." }, { status: 400 });
}
