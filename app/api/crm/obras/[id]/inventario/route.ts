/**
 * E5 — Inventário da obra (leitura da VIEW vw_hub_inventario = Entrada − Saída + Devolução + Ajuste).
 *
 * SEGURANÇA: tenant da sessão, filtro `.eq("tenant_id")` PURO + posse da obra. crmDb é service-role
 * (RLS bypassada) → a view security_invoker não nos protege; o filtro explícito é a proteção.
 * Estoque negativo é PERMITIDO (a UI mostra alerta ⛔, nunca esconde). Tolerante a migração pendente.
 */

import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { assertObraDoTenant, ehTabelaAusente } from "@/lib/crm/obra-route-helpers";

type Params = { params: Promise<{ id: string }> };

const SELECT_INV =
  "obra_id, catalogo_id, descricao, categoria, unidade, codigo_catalogo, em_estoque, total_entrada, total_saida, total_devolucao, total_ajuste, num_movimentos, ultima_mov_em";

const AVISO_PENDENTE = "Inventário ainda não ativo (migração E5 pendente — janela do dono).";

/** GET = inventário derivado da obra. ?categoria=material filtra; ?historico=<catalogo_id> traz as mov. */
export async function GET(request: NextRequest, { params }: Params) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id: obraId } = await params;
  const tenantErr = await assertObraDoTenant(obraId, g.ctx.tenantId);
  if (tenantErr) return tenantErr;

  const url = new URL(request.url);
  const categoria = url.searchParams.get("categoria") || "";
  const historicoCatalogo = url.searchParams.get("historico") || "";
  const supabase = crmDb();

  // Histórico de movimentações de um item (append-only, mais recente primeiro).
  if (historicoCatalogo) {
    const { data, error } = await supabase
      .from("hub_estoque_mov")
      .select("id, tipo, quantidade, descricao, unidade, motivo, registrado_por, origem, pedido_id, criado_em")
      .eq("obra_id", obraId)
      .eq("tenant_id", g.ctx.tenantId)
      .eq("catalogo_id", historicoCatalogo === "null" ? null : historicoCatalogo)
      .order("criado_em", { ascending: false })
      .limit(200);
    if (error) {
      if (ehTabelaAusente(error)) {
        return NextResponse.json({ data: [], migracao_pendente: true, aviso: AVISO_PENDENTE });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data: data ?? [], tipo: "historico", migracao_pendente: false });
  }

  let q = supabase
    .from("vw_hub_inventario")
    .select(SELECT_INV)
    .eq("obra_id", obraId)
    .eq("tenant_id", g.ctx.tenantId)
    .order("descricao", { ascending: true })
    .limit(500);
  if (categoria) q = q.eq("categoria", categoria);

  const { data, error } = await q;
  if (error) {
    if (ehTabelaAusente(error)) {
      return NextResponse.json({ data: [], migracao_pendente: true, aviso: AVISO_PENDENTE });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [], migracao_pendente: false });
}
