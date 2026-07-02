/**
 * E5 — Solicitações de Compra (SC) da obra: cabeçalho (hub_pedidos_material) + itens (hub_pedido_itens).
 *
 * SEGURANÇA (regra sistêmica E0/E1/E2/E3): crmDb() é service-role e BYPASSA RLS — o isolamento
 * depende 100% do filtro no código. Toda query filtra `.eq("tenant_id", g.ctx.tenantId)` PURO
 * (nunca `.or('...is.null')`) E `.eq("obra_id", obraId)`. A obra é validada por posse (404 se o
 * tenant_id não bate). tenant_id vem SEMPRE da sessão (requireCrm*), nunca do body.
 *
 * GATE DE COMPRA: a SC nasce em 'rascunho'/'cotando' (a IA prepara, NUNCA aprova). Aprovar a
 * compra é decisão HUMANA no PATCH de [scid] (requireCrmComercial). "NADA SE PERDE": nunca
 * DELETE — cancelar = status='cancelado'.
 *
 * TOLERÂNCIA: tabela/coluna ausente (migração E5 pendente) → GET { data: [], migracao_pendente: true };
 * POST → 503 com aviso honesto. Nunca quebra.
 */

import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmComercial, requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { assertObraDoTenant, ehTabelaAusente } from "@/lib/crm/obra-route-helpers";
import {
  isTipoMaterialSc,
  isUrgenciaSc,
  isOrigemSc,
  sanitizarCotacoes,
  pontuarCotacoes,
  type TipoMaterialSc,
} from "@/lib/obras/estoque";

type Params = { params: Promise<{ id: string }> };

const SELECT_SC =
  "id, codigo, obra_id, descricao, status, valor_estimado, solicitado_por, tipo_material, frente_id, restricao_id, urgencia, origem, aprovado_por, aprovado_em, entregue_em, entrega_parcial, criado_em, atualizado_em";

const SELECT_ITEM =
  "id, pedido_id, catalogo_id, descricao_snapshot, categoria, unidade, qtd_pedida, qtd_entregue, preco_unit_estimado, preco_unit_final, cotacoes_json, item_fora_catalogo, ordem";

const AVISO_PENDENTE = "Compras & estoque ainda não ativos (migração E5 pendente — janela do dono).";

/** GET = lista as SCs da obra (com itens), mais recente primeiro. ?abertas=1 filtra não-fechadas. */
export async function GET(request: NextRequest, { params }: Params) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id: obraId } = await params;
  const tenantErr = await assertObraDoTenant(obraId, g.ctx.tenantId);
  if (tenantErr) return tenantErr;

  const url = new URL(request.url);
  const soAbertas = url.searchParams.get("abertas") === "1";
  const supabase = crmDb();

  let q = supabase
    .from("hub_pedidos_material")
    .select(SELECT_SC)
    .eq("obra_id", obraId)
    .eq("tenant_id", g.ctx.tenantId)
    .order("criado_em", { ascending: false })
    .limit(300);
  if (soAbertas) q = q.in("status", ["rascunho", "cotando", "aprovado", "entregue_parcial"]);

  const { data: scs, error } = await q;
  if (error) {
    if (ehTabelaAusente(error)) {
      return NextResponse.json({ data: [], migracao_pendente: true, aviso: AVISO_PENDENTE });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const lista = scs ?? [];
  if (lista.length === 0) return NextResponse.json({ data: [], migracao_pendente: false });

  // Itens de todas as SCs em uma query (evita N+1). Tolerante: tabela de itens pode não existir.
  const ids = lista.map((s) => String(s.id));
  const { data: itens, error: errItens } = await supabase
    .from("hub_pedido_itens")
    .select(SELECT_ITEM)
    .in("pedido_id", ids)
    .eq("tenant_id", g.ctx.tenantId)
    .order("ordem", { ascending: true });

  const itensPorPedido = new Map<string, unknown[]>();
  if (!errItens && itens) {
    for (const it of itens) {
      const arr = itensPorPedido.get(String(it.pedido_id)) ?? [];
      arr.push(it);
      itensPorPedido.set(String(it.pedido_id), arr);
    }
  }

  const data = lista.map((s) => ({ ...s, itens: itensPorPedido.get(String(s.id)) ?? [] }));
  return NextResponse.json({ data, migracao_pendente: false });
}

type ItemEntrada = {
  catalogo_id?: string | null;
  descricao?: string;
  categoria?: string | null;
  unidade?: string | null;
  qtd_pedida?: number;
  preco_unit_estimado?: number | null;
  cotacoes_json?: unknown;
};

/**
 * POST = cria a SC com itens. A IA pode preparar (origem='ia'), mas a SC nasce em 'rascunho' ou
 * 'cotando' — NUNCA 'aprovado' (gate humano é o PATCH). Código por gerar_codigo_sc (atômico por tenant).
 */
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

  const itensRaw = Array.isArray(body.itens) ? (body.itens as ItemEntrada[]) : [];
  const descricaoLivre = typeof body.descricao === "string" ? body.descricao.trim() : "";
  if (itensRaw.length === 0 && !descricaoLivre) {
    return NextResponse.json(
      { error: "Informe ao menos um item ou uma descrição da SC." },
      { status: 400 }
    );
  }

  const tipoMaterial: TipoMaterialSc =
    typeof body.tipo_material === "string" && isTipoMaterialSc(body.tipo_material)
      ? body.tipo_material
      : "material";
  const urgencia =
    typeof body.urgencia === "string" && isUrgenciaSc(body.urgencia) ? body.urgencia : "normal";
  // SEGURANÇA: status do caller é restrito a rascunho/cotando — aprovar é gate humano no PATCH.
  const statusEntrada = typeof body.status === "string" ? body.status.trim() : "rascunho";
  const status = statusEntrada === "cotando" ? "cotando" : "rascunho";
  const origem =
    typeof body.origem === "string" && isOrigemSc(body.origem) ? body.origem : "manual";

  const supabase = crmDb();

  // Código atômico por tenant (RPC). Degrada para timestamp se a RPC ainda não existir.
  let codigo = `SC-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
  const { data: codigoRpc, error: errCodigo } = await supabase.rpc("gerar_codigo_sc", {
    p_tenant: g.ctx.tenantId,
  });
  if (!errCodigo && typeof codigoRpc === "string" && codigoRpc.trim()) codigo = codigoRpc.trim();

  // Resumo textual do cabeçalho (mantém compatível com a tela legada que lê só `descricao`).
  const descricaoCabecalho =
    descricaoLivre ||
    itensRaw
      .map((i) => `${i.qtd_pedida ?? ""} ${(i.descricao ?? "").trim()}`.trim())
      .filter(Boolean)
      .join(", ")
      .slice(0, 500) ||
    "Solicitação de compra";

  const valorEstimado = itensRaw.reduce((acc, i) => {
    const q = Number(i.qtd_pedida) || 0;
    const p = Number(i.preco_unit_estimado) || 0;
    return acc + q * p;
  }, 0);

  const insertSc: Record<string, unknown> = {
    codigo,
    obra_id: obraId,
    tenant_id: g.ctx.tenantId,
    descricao: descricaoCabecalho,
    status,
    tipo_material: tipoMaterial,
    urgencia,
    origem,
    valor_estimado: valorEstimado > 0 ? valorEstimado : null,
    solicitado_por:
      typeof body.solicitado_por === "string" ? body.solicitado_por.trim() || g.ctx.userId : g.ctx.userId,
    frente_id: typeof body.frente_id === "string" && body.frente_id.trim() ? body.frente_id.trim() : null,
    restricao_id:
      typeof body.restricao_id === "string" && body.restricao_id.trim() ? body.restricao_id.trim() : null,
  };

  const { data: sc, error: errSc } = await supabase
    .from("hub_pedidos_material")
    .insert(insertSc)
    .select(SELECT_SC)
    .single();

  if (errSc) {
    if (ehTabelaAusente(errSc)) {
      return NextResponse.json({ error: AVISO_PENDENTE, migracao_pendente: true }, { status: 503 });
    }
    return NextResponse.json({ error: errSc.message }, { status: 500 });
  }

  // Itens estruturados (Click-and-Go). Tolerante: se a tabela de itens não existir, a SC fica
  // só com a descrição (degrada — a tela legada continua lendo `descricao`).
  let itensInseridos: unknown[] = [];
  if (itensRaw.length > 0) {
    const rows = itensRaw
      .map((i, idx) => {
        const desc = (i.descricao ?? "").trim();
        const qtd = Number(i.qtd_pedida);
        if (!desc || !Number.isFinite(qtd) || qtd <= 0) return null;
        const cot = pontuarCotacoes(sanitizarCotacoes(i.cotacoes_json));
        return {
          pedido_id: String(sc.id),
          tenant_id: g.ctx.tenantId,
          catalogo_id:
            typeof i.catalogo_id === "string" && i.catalogo_id.trim() ? i.catalogo_id.trim() : null,
          descricao_snapshot: desc.slice(0, 240),
          categoria: i.categoria ?? tipoMaterial,
          unidade: i.unidade ?? null,
          qtd_pedida: qtd,
          preco_unit_estimado:
            i.preco_unit_estimado != null && Number.isFinite(Number(i.preco_unit_estimado))
              ? Number(i.preco_unit_estimado)
              : null,
          cotacoes_json: cot,
          item_fora_catalogo: !(typeof i.catalogo_id === "string" && i.catalogo_id.trim()),
          ordem: idx,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (rows.length > 0) {
      const { data: itensData, error: errItens } = await supabase
        .from("hub_pedido_itens")
        .insert(rows)
        .select(SELECT_ITEM);
      if (errItens && !ehTabelaAusente(errItens)) {
        return NextResponse.json({ error: errItens.message }, { status: 500 });
      }
      itensInseridos = itensData ?? [];
    }
  }

  return NextResponse.json({ data: { ...sc, itens: itensInseridos } }, { status: 201 });
}
