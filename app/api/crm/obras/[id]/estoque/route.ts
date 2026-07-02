/**
 * E5 — Movimentação de estoque (aba "Movimentação"): registrar SAÍDA / DEVOLUÇÃO / AJUSTE.
 *
 * A ENTRADA nasce da cascata SC→Inventário (RPC hub_sc_registrar_entrega), não aqui — este
 * endpoint é o lado HUMANO (consumo/devolução/correção). "NADA SE PERDE": cada movimento é uma
 * NOVA linha em hub_estoque_mov (APPEND-ONLY); a view recalcula o saldo. Estoque negativo é
 * PERMITIDO (não bloqueia; a UI avisa antes via preview).
 *
 * SEGURANÇA: tenant da sessão, filtro `.eq("tenant_id")` PURO + posse da obra. quantidade>0.
 */

import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmComercial } from "@/lib/crm/crm-api-auth";
import { isTipoMovimento } from "@/lib/obras/estoque";
import { assertObraDoTenant, ehTabelaAusente } from "@/lib/crm/obra-route-helpers";

type Params = { params: Promise<{ id: string }> };

const AVISO_PENDENTE = "Movimentação ainda não ativa (migração E5 pendente — janela do dono).";

/** POST = registra uma movimentação manual (saida/devolucao/ajuste). entrada → use a SC. */
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

  const tipoRaw = typeof body.tipo === "string" ? body.tipo.trim() : "";
  if (!isTipoMovimento(tipoRaw)) {
    return NextResponse.json(
      { error: "Tipo inválido (saida, devolucao ou ajuste)." },
      { status: 400 }
    );
  }
  // Entrada é exclusiva da cascata SC (audit trail: nasce de uma compra aprovada e entregue).
  if (tipoRaw === "entrada") {
    return NextResponse.json(
      { error: "Entradas são registradas pela entrega da SC, não manualmente." },
      { status: 400 }
    );
  }

  const quantidade = Number(body.quantidade);
  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    return NextResponse.json({ error: "Quantidade deve ser maior que zero." }, { status: 400 });
  }

  const descricao = typeof body.descricao === "string" ? body.descricao.trim() : "";
  const catalogoId =
    typeof body.catalogo_id === "string" && body.catalogo_id.trim() ? body.catalogo_id.trim() : null;
  if (!descricao && !catalogoId) {
    return NextResponse.json({ error: "Informe o item (catalogo_id ou descrição)." }, { status: 400 });
  }

  const supabase = crmDb();

  // Resolve o snapshot do item a partir do catálogo (se houver), para a movimentação ser autocontida.
  let descricaoFinal = descricao;
  let codigoCatalogo: string | null =
    typeof body.codigo_catalogo === "string" ? body.codigo_catalogo.trim() || null : null;
  let categoria: string | null = typeof body.categoria === "string" ? body.categoria.trim() || null : null;
  let unidade: string | null = typeof body.unidade === "string" ? body.unidade.trim() || null : null;

  if (catalogoId) {
    // catalogo: tenant OU global; NULL=global legítimo (E0), não o leak de NULL=órfão.
    const { data: cat } = await supabase
      .from("hub_catalogo")
      .select("codigo, descricao, categoria, unidade")
      .eq("id", catalogoId)
      .or(`tenant_id.eq.${g.ctx.tenantId},tenant_id.is.null`)
      .maybeSingle();
    if (cat) {
      descricaoFinal = descricaoFinal || String(cat.descricao ?? "");
      codigoCatalogo = codigoCatalogo || (cat.codigo ? String(cat.codigo) : null);
      categoria = categoria || (cat.categoria ? String(cat.categoria) : null);
      unidade = unidade || (cat.unidade ? String(cat.unidade) : null);
    }
  }
  if (!descricaoFinal) descricaoFinal = "Item sem descrição";

  const { data, error } = await supabase
    .from("hub_estoque_mov")
    .insert({
      obra_id: obraId,
      tenant_id: g.ctx.tenantId,
      catalogo_id: catalogoId,
      codigo_catalogo: codigoCatalogo,
      descricao: descricaoFinal.slice(0, 240),
      categoria,
      unidade,
      tipo: tipoRaw,
      quantidade,
      frente_id: typeof body.frente_id === "string" && body.frente_id.trim() ? body.frente_id.trim() : null,
      motivo: typeof body.motivo === "string" ? body.motivo.trim().slice(0, 500) || null : null,
      registrado_por: g.ctx.userId ?? "humano",
      origem: "manual",
    })
    .select("id, tipo, quantidade, descricao, catalogo_id, criado_em")
    .single();

  if (error) {
    if (ehTabelaAusente(error)) {
      return NextResponse.json({ error: AVISO_PENDENTE, migracao_pendente: true }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}
