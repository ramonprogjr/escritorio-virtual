/**
 * E5 — Execução das 2 ferramentas de IA de Compras→Estoque.
 *
 * MESMA garantia das tools E0/E2/E3/A0/A1:
 *  - LEITURA livre (hub_obra_estoque_consultar não tem gate canal_whatsapp);
 *  - ESCRITA (hub_obra_sc_criar) recusa no canal_whatsapp — é do copiloto interno, não do
 *    atendimento — E continua sob o gate do copiloto (HMAC + allowlist + confirmação humana).
 *    GATE DE COMPRA: a SC nasce em RASCUNHO (a IA prepara, NUNCA aprova; aprovar é 2º gate na tela
 *    com papel humano). Aprovar compra por voz é PROIBIDO por design.
 *  - tenant vem de ctx.tenantId (sessão), nunca do body; filtro `.eq("tenant_id")` PURO + posse da obra.
 *
 * Reuso: hub_catalogo (match fuzzy material), gerar_codigo_sc (código atômico), helpers puros de
 * lib/obras/estoque, vw_hub_inventario (leitura). Não duplica nenhuma tool existente.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultTenantId } from "@/lib/tenant-default";
import { isTipoMaterialSc, formulaInventario, type TipoMaterialSc } from "@/lib/obras/estoque";

type ObraCtx = { tenantId?: string; modoOperacao?: string | null; userId?: string };

function recusaSeCanalWhatsapp(ctx: ObraCtx): string | null {
  if (ctx.modoOperacao === "canal_whatsapp") {
    return JSON.stringify({
      erro: "ferramenta_escrita_obra_indisponivel_no_whatsapp",
      nota: "Compras/SC são tratadas pelo copiloto interno, não pelo atendimento WhatsApp.",
    });
  }
  return null;
}

function ehTabelaAusente(error: { message?: string } | null): boolean {
  if (!error) return false;
  return /relation .*does not exist|function .*does not exist|column .* does not exist/i.test(
    error.message ?? ""
  );
}

async function obraDoTenant(supabase: SupabaseClient, obraId: string, tenant: string): Promise<boolean> {
  if (!obraId) return false;
  const { data } = await supabase
    .from("hub_obras")
    .select("id, tenant_id")
    .eq("id", obraId)
    .maybeSingle();
  return !!data && data.tenant_id === tenant;
}

/**
 * Match fuzzy de material no catálogo (global + tenant). Devolve:
 *  - { item } quando casa exatamente um;
 *  - { ambiguidade } quando casa vários (chip-picker ANTES do gate);
 *  - { vazio } (a tela oferece "item fora do catálogo").
 */
async function resolverMaterial(
  supabase: SupabaseClient,
  tenant: string,
  termo: string,
  categoria: TipoMaterialSc
): Promise<
  | { item: { id: string; codigo: string; descricao: string; unidade: string | null } }
  | { ambiguidade: Array<{ id: string; codigo: string; descricao: string; unidade: string | null }> }
  | { vazio: true }
  | { migracaoPendente: true }
> {
  const t = termo.trim();
  if (!t) return { vazio: true };
  const { data, error } = await supabase
    .from("hub_catalogo")
    .select("id, codigo, descricao, unidade, tenant_id")
    .eq("categoria", categoria)
    .eq("ativo", true)
    .or(`tenant_id.eq.${tenant},tenant_id.is.null`)
    .ilike("descricao", `%${t}%`)
    .limit(10);
  if (error && ehTabelaAusente(error)) return { migracaoPendente: true };
  const linhas = data ?? [];
  if (linhas.length === 0) return { vazio: true };
  if (linhas.length === 1) {
    return {
      item: {
        id: String(linhas[0].id),
        codigo: String(linhas[0].codigo),
        descricao: String(linhas[0].descricao),
        unidade: (linhas[0].unidade as string | null) ?? null,
      },
    };
  }
  return {
    ambiguidade: linhas.map((l) => ({
      id: String(l.id),
      codigo: String(l.codigo),
      descricao: String(l.descricao),
      unidade: (l.unidade as string | null) ?? null,
    })),
  };
}

export async function executarFerramentaEstoque(
  toolName: "hub_obra_sc_criar" | "hub_obra_estoque_consultar",
  args: Record<string, unknown>,
  ctx: ObraCtx,
  supabase: SupabaseClient
): Promise<string> {
  const tenant = (ctx.tenantId && ctx.tenantId.trim()) || defaultTenantId();
  const obraId = typeof args.obra_id === "string" ? args.obra_id.trim() : "";

  switch (toolName) {
    // ── LEITURA: consultar inventário (view derivada) ──
    case "hub_obra_estoque_consultar": {
      if (!obraId) {
        return JSON.stringify({ erro: "obra_id_ausente", nota: "Abra a ficha da obra para consultar o estoque." });
      }
      if (!(await obraDoTenant(supabase, obraId, tenant))) {
        return JSON.stringify({ erro: "obra_nao_encontrada", obra_id: obraId });
      }
      let q = supabase
        .from("vw_hub_inventario")
        .select(
          "catalogo_id, descricao, categoria, unidade, em_estoque, total_entrada, total_saida, total_devolucao, total_ajuste, ultima_mov_em"
        )
        .eq("obra_id", obraId)
        .eq("tenant_id", tenant)
        .limit(120);
      const termo = typeof args.item === "string" ? args.item.trim() : "";
      if (termo) q = q.ilike("descricao", `%${termo}%`);
      const categoria = typeof args.categoria === "string" ? args.categoria.trim() : "";
      if (categoria && isTipoMaterialSc(categoria)) q = q.eq("categoria", categoria);

      const { data, error } = await q;
      if (error) {
        if (ehTabelaAusente(error)) {
          return JSON.stringify({ erro: "migracao_e5_pendente", inventario: [], total: 0 });
        }
        return JSON.stringify({ erro: "supabase", detalhe: error.message });
      }
      const linhas = data ?? [];
      return JSON.stringify({
        total: linhas.length,
        inventario: linhas.slice(0, 40).map((r) => ({
          item: r.descricao,
          unidade: r.unidade,
          em_estoque: Number(r.em_estoque ?? 0),
          formula: formulaInventario(r),
          negativo: Number(r.em_estoque ?? 0) < 0,
          ultima_mov: r.ultima_mov_em,
        })),
      });
    }

    // ── ESCRITA: criar SC (gate sempre — é dinheiro). Nasce em RASCUNHO, nunca aprovada. ──
    case "hub_obra_sc_criar": {
      const gate = recusaSeCanalWhatsapp(ctx);
      if (gate) return gate;
      if (!obraId) return JSON.stringify({ erro: "obra_id_ausente", nota: "Abra a ficha da obra." });
      if (!(await obraDoTenant(supabase, obraId, tenant))) {
        return JSON.stringify({ erro: "obra_nao_encontrada", obra_id: obraId });
      }

      const termo = typeof args.item === "string" ? args.item.trim() : "";
      if (!termo) {
        return JSON.stringify({ erro: "item_ausente", nota: "Diga o que comprar (ex.: cimento CP-II)." });
      }
      const qtd = Number(args.quantidade);
      if (!Number.isFinite(qtd) || qtd <= 0) {
        return JSON.stringify({ erro: "quantidade_invalida", nota: "Diga a quantidade (ex.: 50 sacos)." });
      }
      const categoria: TipoMaterialSc =
        typeof args.tipo_material === "string" && isTipoMaterialSc(args.tipo_material)
          ? args.tipo_material
          : "material";

      // Match fuzzy no catálogo. Ambíguo → chip-picker ANTES do gate (não cria nada).
      const r = await resolverMaterial(supabase, tenant, termo, categoria);
      if ("migracaoPendente" in r) {
        return JSON.stringify({ erro: "migracao_e5_pendente", nota: "Catálogo/compras ainda não ativos nesta base." });
      }
      if ("ambiguidade" in r) {
        return JSON.stringify({
          precisa_desambiguar: true,
          nota: "Achei mais de um item — escolha qual.",
          opcoes: r.ambiguidade,
        });
      }

      const catalogoId = "item" in r ? r.item.id : null;
      const descricaoItem = "item" in r ? r.item.descricao : termo;
      const unidade = "item" in r ? r.item.unidade : null;

      // Código atômico por tenant (degrada para timestamp se a RPC não existir).
      let codigo = `SC-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
      const { data: codigoRpc } = await supabase.rpc("gerar_codigo_sc", { p_tenant: tenant });
      if (typeof codigoRpc === "string" && codigoRpc.trim()) codigo = codigoRpc.trim();

      const frenteId = typeof args.frente_id === "string" && args.frente_id.trim() ? args.frente_id.trim() : null;

      // SC em RASCUNHO (a IA prepara; aprovar a compra é 2º gate humano na tela).
      const { data: sc, error: errSc } = await supabase
        .from("hub_pedidos_material")
        .insert({
          codigo,
          obra_id: obraId,
          tenant_id: tenant,
          descricao: `${qtd} ${descricaoItem}`.slice(0, 500),
          status: "rascunho",
          tipo_material: categoria,
          urgencia: "normal",
          origem: "ia",
          frente_id: frenteId,
          solicitado_por: ctx.userId ?? "copiloto",
        })
        .select("id, codigo, status")
        .single();

      if (errSc) {
        if (ehTabelaAusente(errSc)) {
          return JSON.stringify({ erro: "migracao_e5_pendente", nota: "Compras ainda não ativas nesta base." });
        }
        return JSON.stringify({ erro: "supabase", detalhe: errSc.message });
      }

      // Item estruturado (tolerante: se a tabela não existir, a SC fica só com a descrição).
      const { error: errItem } = await supabase.from("hub_pedido_itens").insert({
        pedido_id: String(sc.id),
        tenant_id: tenant,
        catalogo_id: catalogoId,
        descricao_snapshot: descricaoItem.slice(0, 240),
        categoria,
        unidade,
        qtd_pedida: qtd,
        item_fora_catalogo: catalogoId === null,
        ordem: 0,
      });
      if (errItem && !ehTabelaAusente(errItem)) {
        return JSON.stringify({ erro: "supabase", detalhe: errItem.message });
      }

      return JSON.stringify({
        ok: true,
        sc: { id: sc.id, codigo: sc.codigo, status: sc.status },
        item: descricaoItem,
        quantidade: qtd,
        nota: `📦 SC ${sc.codigo} criada em rascunho: ${qtd} ${descricaoItem}. Aprovar a compra é decisão humana na tela.`,
      });
    }

    default:
      return JSON.stringify({ erro: "ferramenta_estoque_desconhecida", nome: toolName });
  }
}
