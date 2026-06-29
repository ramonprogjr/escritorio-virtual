/**
 * E5 ← E3 — Elo "falta material" → SC. O card de bloqueio (restrição tipo='material',
 * acao_sugerida='gerar_pedido') tem o botão [Gerar pedido]. Este POST cria uma SC em RASCUNHO
 * pré-preenchida (origem='e3_restricao', restricao_id, frente_id herdado da restrição/item) e
 * grava de volta pedido_material_id na restrição (fecha o elo bidirecional).
 *
 * NÃO aprova nada (gate humano é o PATCH da SC). NÃO resolve a restrição (quem destrava é o humano
 * quando a entrega chegar). Idempotente: se a restrição já tem pedido_material_id ativo, reaproveita.
 *
 * TOLERÂNCIA (E3 ou E5 ausente): degrada para 503 com aviso honesto via isMissingPgColumn — não quebra.
 */

import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmComercial } from "@/lib/crm/crm-api-auth";
import { assertObraDoTenant, ehTabelaAusente } from "../../../sc/route";

type Params = { params: Promise<{ id: string; rid: string }> };

const SELECT_SC =
  "id, codigo, obra_id, descricao, status, tipo_material, frente_id, restricao_id, urgencia, origem, criado_em";
const AVISO_PENDENTE =
  "Compras/restrições ainda não ativos (migração E3/E5 pendente — janela do dono).";

export async function POST(request: NextRequest, { params }: Params) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id: obraId, rid: restricaoId } = await params;
  const tenantErr = await assertObraDoTenant(obraId, g.ctx.tenantId);
  if (tenantErr) return tenantErr;

  const supabase = crmDb();

  // Carrega a restrição (posse: obra + tenant) — fonte do pré-preenchimento.
  const { data: restricao, error: errR } = await supabase
    .from("hub_obra_restricoes")
    .select("id, obra_id, tenant_id, tipo, titulo, descricao, item_id, frente_id, pedido_material_id, status")
    .eq("id", restricaoId)
    .eq("obra_id", obraId)
    .eq("tenant_id", g.ctx.tenantId)
    .maybeSingle();
  if (errR) {
    if (ehTabelaAusente(errR)) {
      return NextResponse.json({ error: AVISO_PENDENTE, migracao_pendente: true }, { status: 503 });
    }
    return NextResponse.json({ error: errR.message }, { status: 500 });
  }
  if (!restricao) return NextResponse.json({ error: "Restrição não encontrada" }, { status: 404 });

  // Idempotência: já existe SC ligada e não cancelada? Reaproveita (não duplica pedido).
  if (typeof restricao.pedido_material_id === "string" && restricao.pedido_material_id.trim()) {
    const { data: existente } = await supabase
      .from("hub_pedidos_material")
      .select(SELECT_SC)
      .eq("id", restricao.pedido_material_id.trim())
      .eq("tenant_id", g.ctx.tenantId)
      .neq("status", "cancelado")
      .maybeSingle();
    if (existente) {
      return NextResponse.json({ data: existente, idempotente: true });
    }
  }

  // Herda a frente: da restrição, ou do item ligado.
  let frenteId: string | null =
    typeof restricao.frente_id === "string" && restricao.frente_id.trim() ? restricao.frente_id.trim() : null;
  let itemNome = "";
  if (typeof restricao.item_id === "string" && restricao.item_id.trim()) {
    const { data: item } = await supabase
      .from("hub_obra_itens")
      .select("nome, frente_id")
      .eq("id", restricao.item_id.trim())
      .eq("tenant_id", g.ctx.tenantId)
      .maybeSingle();
    if (item) {
      itemNome = typeof item.nome === "string" ? item.nome : "";
      if (!frenteId && typeof item.frente_id === "string" && item.frente_id.trim()) {
        frenteId = item.frente_id.trim();
      }
    }
  }

  // Código atômico (degrada para timestamp se a RPC não existir).
  let codigo = `SC-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
  const { data: codigoRpc, error: errCodigo } = await supabase.rpc("gerar_codigo_sc", {
    p_tenant: g.ctx.tenantId,
  });
  if (!errCodigo && typeof codigoRpc === "string" && codigoRpc.trim()) codigo = codigoRpc.trim();

  const descricaoSc =
    (typeof restricao.titulo === "string" && restricao.titulo.trim()) ||
    (itemNome ? `Material para ${itemNome}` : "") ||
    (typeof restricao.descricao === "string" && restricao.descricao.trim()) ||
    "Solicitação de material (bloqueio)";

  const { data: sc, error: errSc } = await supabase
    .from("hub_pedidos_material")
    .insert({
      codigo,
      obra_id: obraId,
      tenant_id: g.ctx.tenantId,
      descricao: descricaoSc.slice(0, 500),
      status: "rascunho",
      tipo_material: "material",
      urgencia: "urgente", // veio de um bloqueio ativo → urgência elevada por padrão
      origem: "e3_restricao",
      restricao_id: restricaoId,
      frente_id: frenteId,
      solicitado_por: g.ctx.userId ?? "humano",
    })
    .select(SELECT_SC)
    .single();

  if (errSc) {
    if (ehTabelaAusente(errSc)) {
      return NextResponse.json({ error: AVISO_PENDENTE, migracao_pendente: true }, { status: 503 });
    }
    return NextResponse.json({ error: errSc.message }, { status: 500 });
  }

  // Fecha o elo bidirecional: grava pedido_material_id de volta na restrição (não derruba se falhar).
  await supabase
    .from("hub_obra_restricoes")
    .update({ pedido_material_id: String(sc.id), atualizado_em: new Date().toISOString() })
    .eq("id", restricaoId)
    .eq("obra_id", obraId)
    .eq("tenant_id", g.ctx.tenantId);

  return NextResponse.json({ data: sc }, { status: 201 });
}
