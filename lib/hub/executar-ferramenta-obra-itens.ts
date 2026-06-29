/**
 * E2 — Execução das 3 ferramentas de IA de Itens × Subitens da obra.
 *
 * MESMA garantia das tools E0/A0:
 *  - SEM gate `canal_whatsapp` (nascem para o copiloto GLOBAL do dono autenticado);
 *  - escrita (avanco/andamento) continua sob o gate do copiloto (HMAC + allowlist + confirmação);
 *  - tenant vem de ctx.tenantId (sessão), nunca do body; filtro `.eq("tenant_id")` PURO;
 *  - leitura usa a VIEW vw_hub_obra_itens_situacao para trazer a Situação (auto).
 *
 * Situação NUNCA é escrita por voz (é derivada). Ambiguidade (mesmo nome em vários andares)
 * → devolve `precisa_desambiguar` com as opções, em vez de aplicar a vários.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultTenantId } from "@/lib/tenant-default";
import { isAndamentoItem, isSituacaoItem, BLOQUEIOS } from "@/lib/obras/itens-situacao";

type ObraCtx = { tenantId?: string; modoOperacao?: string | null };

function recusaSeCanalWhatsapp(ctx: ObraCtx): string | null {
  if (ctx.modoOperacao === "canal_whatsapp") {
    return JSON.stringify({
      erro: "ferramenta_escrita_obra_indisponivel_no_whatsapp",
      nota: "Avanço/andamento de item é feito pelo copiloto interno, não pelo atendimento WhatsApp.",
    });
  }
  return null;
}

/** Confirma posse da obra (service-role bypassa RLS → checagem explícita). */
async function obraDoTenant(
  supabase: SupabaseClient,
  obraId: string,
  tenant: string
): Promise<boolean> {
  if (!obraId) return false;
  const { data } = await supabase
    .from("hub_obras")
    .select("id, tenant_id")
    .eq("id", obraId)
    .maybeSingle();
  return !!data && data.tenant_id === tenant;
}

const SELECT_LISTA =
  "id, codigo, nome, disciplina_slug, area_codigo, area_label, parent_id, pct_avanco, andamento, situacao, dias_atraso, falta_pessoa, falta_documento, falta_material, falta_ferramenta, falta_equipamento";

/**
 * Resolve UM item por id (preferido) ou nome (+ área para desambiguar). Devolve:
 *  - { item } quando encontra exatamente um;
 *  - { ambiguidade: [...] } quando o nome casa com vários (pede para escolher);
 *  - { vazio: true } quando não acha nada.
 */
async function resolverItem(
  supabase: SupabaseClient,
  tenant: string,
  obraId: string,
  args: { item_id?: unknown; nome?: unknown; area_codigo?: unknown }
): Promise<
  | { item: Record<string, unknown> }
  | { ambiguidade: Array<{ id: string; codigo: string; nome: string; area_label: string | null }> }
  | { vazio: true }
  | { migracaoPendente: true }
> {
  const itemId = typeof args.item_id === "string" ? args.item_id.trim() : "";
  if (itemId) {
    const { data, error } = await supabase
      .from("hub_obra_itens")
      .select("id, codigo, nome, area_label, parent_id, pct_avanco, andamento")
      .eq("id", itemId)
      .eq("obra_id", obraId)
      .eq("tenant_id", tenant)
      .maybeSingle();
    if (error && /relation .*does not exist/i.test(error.message)) return { migracaoPendente: true };
    return data ? { item: data } : { vazio: true };
  }

  const nome = typeof args.nome === "string" ? args.nome.trim() : "";
  if (!nome) return { vazio: true };

  let q = supabase
    .from("hub_obra_itens")
    .select("id, codigo, nome, area_codigo, area_label, parent_id, pct_avanco, andamento")
    .eq("obra_id", obraId)
    .eq("tenant_id", tenant)
    .eq("ativo", true)
    .ilike("nome", `%${nome}%`)
    .limit(10);
  const area = typeof args.area_codigo === "string" ? args.area_codigo.trim() : "";
  if (area) q = q.eq("area_codigo", area);

  const { data, error } = await q;
  if (error && /relation .*does not exist/i.test(error.message)) return { migracaoPendente: true };
  const linhas = data ?? [];
  if (linhas.length === 0) return { vazio: true };
  if (linhas.length === 1) return { item: linhas[0] as Record<string, unknown> };
  return {
    ambiguidade: linhas.map((l) => ({
      id: String(l.id),
      codigo: String(l.codigo),
      nome: String(l.nome),
      area_label: (l.area_label as string | null) ?? null,
    })),
  };
}

export async function executarFerramentaObraItem(
  toolName: "hub_obra_item_listar" | "hub_obra_item_avanco" | "hub_obra_item_andamento",
  args: Record<string, unknown>,
  ctx: ObraCtx,
  supabase: SupabaseClient
): Promise<string> {
  const tenant = (ctx.tenantId && ctx.tenantId.trim()) || defaultTenantId();
  const obraId = typeof args.obra_id === "string" ? args.obra_id.trim() : "";

  switch (toolName) {
    case "hub_obra_item_listar": {
      if (!obraId) return JSON.stringify({ erro: "obra_id_ausente", nota: "Abra a ficha da obra." });
      if (!(await obraDoTenant(supabase, obraId, tenant))) {
        return JSON.stringify({ erro: "obra_nao_encontrada", obra_id: obraId });
      }
      let q = supabase
        .from("vw_hub_obra_itens_situacao")
        .select(SELECT_LISTA)
        .eq("obra_id", obraId)
        .eq("tenant_id", tenant)
        .order("ordem", { ascending: true })
        .limit(80);
      if (typeof args.disciplina_slug === "string" && args.disciplina_slug.trim()) {
        q = q.eq("disciplina_slug", args.disciplina_slug.trim());
      }
      if (typeof args.area_codigo === "string" && args.area_codigo.trim()) {
        q = q.eq("area_codigo", args.area_codigo.trim());
      }
      if (typeof args.situacao === "string" && isSituacaoItem(args.situacao)) {
        q = q.eq("situacao", args.situacao);
      }
      const { data, error } = await q;
      if (error) {
        if (/relation .*does not exist/i.test(error.message)) {
          return JSON.stringify({ erro: "migracao_e2_pendente", itens: [], total: 0 });
        }
        return JSON.stringify({ erro: "supabase", detalhe: error.message });
      }
      const itens = (data ?? []).filter((i) => i.parent_id == null); // só nível-0 no resumo de voz
      return JSON.stringify({
        total: itens.length,
        itens: itens.slice(0, 40).map((i) => ({
          id: i.id,
          codigo: i.codigo,
          nome: i.nome,
          disciplina: i.disciplina_slug,
          andar: i.area_label,
          avanco: i.pct_avanco,
          situacao: i.situacao,
          andamento: i.andamento,
          dias_atraso: i.dias_atraso,
          bloqueios: BLOQUEIOS.filter((b) => i[b.campo] === true).map((b) => b.label),
        })),
      });
    }

    case "hub_obra_item_avanco": {
      const gate = recusaSeCanalWhatsapp(ctx);
      if (gate) return gate;
      if (!obraId) return JSON.stringify({ erro: "obra_id_ausente", nota: "Abra a ficha da obra." });
      if (!(await obraDoTenant(supabase, obraId, tenant))) {
        return JSON.stringify({ erro: "obra_nao_encontrada", obra_id: obraId });
      }
      const pct = Number(args.pct_avanco);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        return JSON.stringify({ erro: "pct_invalido", nota: "Diga um valor de 0 a 100." });
      }
      const r = await resolverItem(supabase, tenant, obraId, args);
      if ("migracaoPendente" in r) {
        return JSON.stringify({
          erro: "migracao_e2_pendente",
          nota: "A tabela de itens ainda não foi criada nesta base — peça para aplicar a migração E2.",
        });
      }
      if ("vazio" in r) return JSON.stringify({ erro: "item_nao_encontrado", nota: "Não achei esse item na obra." });
      if ("ambiguidade" in r) {
        return JSON.stringify({ precisa_desambiguar: true, opcoes: r.ambiguidade });
      }
      const { data, error } = await supabase
        .from("hub_obra_itens")
        .update({ pct_avanco: Math.round(pct * 100) / 100, atualizado_em: new Date().toISOString() })
        .eq("id", String(r.item.id))
        .eq("obra_id", obraId)
        .eq("tenant_id", tenant)
        .select("id, codigo, nome, pct_avanco, andamento")
        .maybeSingle();
      if (error) {
        if (/relation .*does not exist/i.test(error.message)) {
          return JSON.stringify({
            erro: "migracao_e2_pendente",
            nota: "A tabela de itens ainda não foi criada nesta base — peça para aplicar a migração E2.",
          });
        }
        return JSON.stringify({ erro: "supabase", detalhe: error.message });
      }
      if (!data) return JSON.stringify({ erro: "item_nao_atualizado" });
      const sugereFinalizar = pct >= 100 && data.andamento !== "finalizado";
      return JSON.stringify({ ok: true, item: data, sugere_finalizar: sugereFinalizar });
    }

    case "hub_obra_item_andamento": {
      const gate = recusaSeCanalWhatsapp(ctx);
      if (gate) return gate;
      if (!obraId) return JSON.stringify({ erro: "obra_id_ausente", nota: "Abra a ficha da obra." });
      if (!(await obraDoTenant(supabase, obraId, tenant))) {
        return JSON.stringify({ erro: "obra_nao_encontrada", obra_id: obraId });
      }
      const novoAndamento =
        typeof args.andamento === "string" && isAndamentoItem(args.andamento) ? args.andamento : null;
      const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
      if (novoAndamento) patch.andamento = novoAndamento;
      let tocouBloqueio = false;
      for (const b of BLOQUEIOS) {
        if (typeof args[b.campo] === "boolean") {
          patch[b.campo] = args[b.campo];
          tocouBloqueio = true;
        }
      }
      if (!novoAndamento && !tocouBloqueio) {
        return JSON.stringify({ erro: "nada_a_mudar", nota: "Diga o andamento ou o bloqueio (ex.: falta material)." });
      }
      const r = await resolverItem(supabase, tenant, obraId, args);
      if ("migracaoPendente" in r) {
        return JSON.stringify({
          erro: "migracao_e2_pendente",
          nota: "A tabela de itens ainda não foi criada nesta base — peça para aplicar a migração E2.",
        });
      }
      if ("vazio" in r) return JSON.stringify({ erro: "item_nao_encontrado", nota: "Não achei esse item na obra." });
      if ("ambiguidade" in r) {
        return JSON.stringify({ precisa_desambiguar: true, opcoes: r.ambiguidade });
      }
      const { data, error } = await supabase
        .from("hub_obra_itens")
        .update(patch)
        .eq("id", String(r.item.id))
        .eq("obra_id", obraId)
        .eq("tenant_id", tenant)
        .select(
          "id, codigo, nome, andamento, falta_pessoa, falta_documento, falta_material, falta_ferramenta, falta_equipamento"
        )
        .maybeSingle();
      if (error) {
        if (/relation .*does not exist/i.test(error.message)) {
          return JSON.stringify({
            erro: "migracao_e2_pendente",
            nota: "A tabela de itens ainda não foi criada nesta base — peça para aplicar a migração E2.",
          });
        }
        return JSON.stringify({ erro: "supabase", detalhe: error.message });
      }
      if (!data) return JSON.stringify({ erro: "item_nao_atualizado" });
      return JSON.stringify({ ok: true, item: data });
    }

    default:
      return JSON.stringify({ erro: "ferramenta_item_desconhecida", nome: toolName });
  }
}
