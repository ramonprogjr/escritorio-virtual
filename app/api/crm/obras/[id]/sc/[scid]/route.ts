/**
 * E5 — Ações sobre UMA SC: aprovar a compra (GATE HUMANO), mover status, editar cotações,
 * registrar entrega (cascata SC→Inventário via RPC), cancelar (soft-delete).
 *
 * SEGURANÇA: tenant da sessão (requireCrm*), filtro `.eq("tenant_id")` PURO + posse da obra.
 * "NADA SE PERDE": cancelar = status='cancelado' (nunca DELETE); entrega = RPC append-only.
 * GATE: aprovar a compra é decisão HUMANA (requireCrmComercial) — a IA nunca chega aqui aprovando.
 */

import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmComercial } from "@/lib/crm/crm-api-auth";
import {
  isStatusSc,
  sanitizarCotacoes,
  pontuarCotacoes,
} from "@/lib/obras/estoque";
import { assertObraDoTenant, ehTabelaAusente } from "@/lib/crm/obra-route-helpers";

type Params = { params: Promise<{ id: string; scid: string }> };

const SELECT_SC =
  "id, codigo, obra_id, descricao, status, valor_estimado, solicitado_por, tipo_material, frente_id, restricao_id, urgencia, origem, aprovado_por, aprovado_em, entregue_em, entrega_parcial, criado_em, atualizado_em";
const SELECT_ITEM =
  "id, pedido_id, catalogo_id, descricao_snapshot, categoria, unidade, qtd_pedida, qtd_entregue, preco_unit_estimado, preco_unit_final, cotacoes_json, item_fora_catalogo, ordem";

const AVISO_PENDENTE = "Compras & estoque ainda não ativos (migração E5 pendente — janela do dono).";

/** Carrega a SC por posse (obra + tenant). */
async function carregarSc(scId: string, obraId: string, tenantId: string) {
  return crmDb()
    .from("hub_pedidos_material")
    .select("id, obra_id, tenant_id, status, restricao_id")
    .eq("id", scId)
    .eq("obra_id", obraId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id: obraId, scid: scId } = await params;
  const tenantErr = await assertObraDoTenant(obraId, g.ctx.tenantId);
  if (tenantErr) return tenantErr;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { data: atual, error: errGet } = await carregarSc(scId, obraId, g.ctx.tenantId);
  if (errGet) {
    if (ehTabelaAusente(errGet)) {
      return NextResponse.json({ error: AVISO_PENDENTE, migracao_pendente: true }, { status: 503 });
    }
    return NextResponse.json({ error: errGet.message }, { status: 500 });
  }
  if (!atual) return NextResponse.json({ error: "SC não encontrada" }, { status: 404 });

  const supabase = crmDb();
  const acao = typeof body.acao === "string" ? body.acao.trim() : "";

  // ── AÇÃO: registrar entrega (cascata SC→Inventário via RPC idempotente) ──
  if (acao === "registrar_entrega") {
    const itensEntrega = Array.isArray(body.itens) ? body.itens : [];
    if (itensEntrega.length === 0) {
      return NextResponse.json({ error: "Informe os itens entregues (item_id, qtd)." }, { status: 400 });
    }
    const itensJson = itensEntrega
      .map((x) => {
        if (!x || typeof x !== "object" || Array.isArray(x)) return null;
        const o = x as Record<string, unknown>;
        const itemId = typeof o.item_id === "string" ? o.item_id.trim() : "";
        const qtd = Number(o.qtd);
        if (!itemId || !Number.isFinite(qtd) || qtd <= 0) return null;
        return { item_id: itemId, qtd };
      })
      .filter((x): x is { item_id: string; qtd: number } => x !== null);

    if (itensJson.length === 0) {
      return NextResponse.json({ error: "Nenhum item de entrega válido." }, { status: 400 });
    }

    const { data: resultado, error: errRpc } = await supabase.rpc("hub_sc_registrar_entrega", {
      p_pedido_id: scId,
      p_tenant_id: g.ctx.tenantId,
      p_itens: itensJson,
      p_registrado_por: g.ctx.userId ?? "humano",
      p_obs: typeof body.obs === "string" ? body.obs.trim() || null : null,
    });
    if (errRpc) {
      if (ehTabelaAusente(errRpc) || /function .*does not exist/i.test(errRpc.message ?? "")) {
        return NextResponse.json({ error: AVISO_PENDENTE, migracao_pendente: true }, { status: 503 });
      }
      if (/pedido_nao_encontrado/.test(errRpc.message ?? "")) {
        return NextResponse.json({ error: "SC não encontrada" }, { status: 404 });
      }
      return NextResponse.json({ error: errRpc.message }, { status: 500 });
    }
    return NextResponse.json({ data: resultado });
  }

  // ── AÇÃO: aprovar a compra (GATE HUMANO) ──
  if (acao === "aprovar") {
    const { data, error } = await supabase
      .from("hub_pedidos_material")
      .update({
        status: "aprovado",
        aprovado_por: g.ctx.userId ?? "humano",
        aprovado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", scId)
      .eq("obra_id", obraId)
      .eq("tenant_id", g.ctx.tenantId)
      .select(SELECT_SC)
      .maybeSingle();
    if (error) {
      if (ehTabelaAusente(error)) {
        return NextResponse.json({ error: AVISO_PENDENTE, migracao_pendente: true }, { status: 503 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: "SC não encontrada" }, { status: 404 });
    return NextResponse.json({ data });
  }

  // ── AÇÃO: cancelar (soft-delete — NADA SE PERDE) ──
  if (acao === "cancelar") {
    const { data, error } = await supabase
      .from("hub_pedidos_material")
      .update({ status: "cancelado", atualizado_em: new Date().toISOString() })
      .eq("id", scId)
      .eq("obra_id", obraId)
      .eq("tenant_id", g.ctx.tenantId)
      .select(SELECT_SC)
      .maybeSingle();
    if (error) {
      if (ehTabelaAusente(error)) {
        return NextResponse.json({ error: AVISO_PENDENTE, migracao_pendente: true }, { status: 503 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: "SC não encontrada" }, { status: 404 });
    return NextResponse.json({ data });
  }

  // ── AÇÃO: escolher cotação de um item (grava cotacoes_json + preco_unit_final) ──
  if (acao === "escolher_cotacao") {
    const itemId = typeof body.item_id === "string" ? body.item_id.trim() : "";
    if (!itemId) return NextResponse.json({ error: "item_id é obrigatório." }, { status: 400 });
    const cotacoes = pontuarCotacoes(sanitizarCotacoes(body.cotacoes_json));
    const escolhida = cotacoes.find((c) => c.escolhida);
    const patchItem: Record<string, unknown> = {
      cotacoes_json: cotacoes,
      atualizado_em: new Date().toISOString(),
    };
    if (escolhida && Number.isFinite(escolhida.valor_total)) {
      // preço unitário final = valor_total / qtd_pedida (lido do item)
      const { data: itemRow } = await supabase
        .from("hub_pedido_itens")
        .select("qtd_pedida")
        .eq("id", itemId)
        .eq("pedido_id", scId)
        .eq("tenant_id", g.ctx.tenantId)
        .maybeSingle();
      const qtd = itemRow ? Number(itemRow.qtd_pedida) : 0;
      if (qtd > 0) patchItem.preco_unit_final = escolhida.valor_total / qtd;
    }
    const { data, error } = await supabase
      .from("hub_pedido_itens")
      .update(patchItem)
      .eq("id", itemId)
      .eq("pedido_id", scId)
      .eq("tenant_id", g.ctx.tenantId)
      .select(SELECT_ITEM)
      .maybeSingle();
    if (error) {
      if (ehTabelaAusente(error)) {
        return NextResponse.json({ error: AVISO_PENDENTE, migracao_pendente: true }, { status: 503 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
    return NextResponse.json({ data });
  }

  // ── AÇÃO genérica: mover status (rascunho/cotando) — aprovar/entregar têm ação própria ──
  const novoStatus = typeof body.status === "string" ? body.status.trim() : "";
  if (novoStatus) {
    if (!isStatusSc(novoStatus)) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    }
    // Aprovar/entregar/cancelar só pelas ações dedicadas (gate explícito).
    if (["aprovado", "entregue", "entregue_parcial", "cancelado"].includes(novoStatus)) {
      return NextResponse.json(
        { error: "Use a ação dedicada (aprovar / registrar_entrega / cancelar)." },
        { status: 400 }
      );
    }
    const { data, error } = await supabase
      .from("hub_pedidos_material")
      .update({ status: novoStatus, atualizado_em: new Date().toISOString() })
      .eq("id", scId)
      .eq("obra_id", obraId)
      .eq("tenant_id", g.ctx.tenantId)
      .select(SELECT_SC)
      .maybeSingle();
    if (error) {
      if (ehTabelaAusente(error)) {
        return NextResponse.json({ error: AVISO_PENDENTE, migracao_pendente: true }, { status: 503 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: "SC não encontrada" }, { status: 404 });
    return NextResponse.json({ data });
  }

  return NextResponse.json({ error: "Nenhuma ação reconhecida." }, { status: 400 });
}
