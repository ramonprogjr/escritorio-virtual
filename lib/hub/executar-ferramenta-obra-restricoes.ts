/**
 * E3 — Execução das 3 ferramentas de IA de Restrições/Bloqueios da obra.
 *
 * MESMA garantia das tools E0/E2/A0:
 *  - LEITURA livre (listar bloqueios não tem gate `canal_whatsapp`);
 *  - ESCRITA (criar/resolver) recusa no `canal_whatsapp` (recusaSeCanalWhatsapp) — são do
 *    copiloto interno, não do atendimento — E continua sob o gate do copiloto (HMAC + allowlist + confirmação);
 *    resolver = gate REFORÇADO (mesmo padrão de finalizado/cancelado em E2 — aviso extra no card);
 *  - tenant vem de ctx.tenantId (sessão), nunca do body; filtro `.eq("tenant_id")` PURO;
 *  - leitura usa a VIEW vw_hub_obra_bloqueios_hoje (dado fino unificado, sem duplicar E2).
 *
 * Reconciliação com E2 (não-duplicação): criar liga via RPC `promover` (idempotente) +
 * garante o boolean falta_* do item; resolver limpa o boolean. SST (documento) NÃO resolve
 * por voz (regularização auditada). Ambiguidade (mesmo nome em vários andares) → desambiguar.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultTenantId } from "@/lib/tenant-default";
import {
  isTipoRestricao,
  booleanDoTipo,
  ehSstReadonly,
  APRESENTACAO_TIPO,
  type TipoRestricao,
} from "@/lib/obras/restricoes";

type ObraCtx = { tenantId?: string; modoOperacao?: string | null };

function recusaSeCanalWhatsapp(ctx: ObraCtx): string | null {
  if (ctx.modoOperacao === "canal_whatsapp") {
    return JSON.stringify({
      erro: "ferramenta_escrita_obra_indisponivel_no_whatsapp",
      nota: "Bloqueios da obra são tratados pelo copiloto interno, não pelo atendimento WhatsApp.",
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

function ehTabelaAusente(error: { message?: string } | null): boolean {
  if (!error) return false;
  return /relation .*does not exist/i.test(error.message ?? "");
}

/**
 * Resolve UM item por id (preferido) ou nome (+ área). Reusa o padrão de E2:
 *  - { item } quando encontra exatamente um;
 *  - { ambiguidade } quando o nome casa com vários;
 *  - { vazio } / { migracaoPendente }.
 */
async function resolverItem(
  supabase: SupabaseClient,
  tenant: string,
  obraId: string,
  args: { item_id?: unknown; nome?: unknown; area_codigo?: unknown }
): Promise<
  | { item: { id: string; nome: string } }
  | { ambiguidade: Array<{ id: string; codigo: string; nome: string; area_label: string | null }> }
  | { vazio: true }
  | { migracaoPendente: true }
> {
  const itemId = typeof args.item_id === "string" ? args.item_id.trim() : "";
  if (itemId) {
    const { data, error } = await supabase
      .from("hub_obra_itens")
      .select("id, nome")
      .eq("id", itemId)
      .eq("obra_id", obraId)
      .eq("tenant_id", tenant)
      .maybeSingle();
    if (error && ehTabelaAusente(error)) return { migracaoPendente: true };
    return data ? { item: { id: String(data.id), nome: String(data.nome) } } : { vazio: true };
  }

  const nome = typeof args.nome === "string" ? args.nome.trim() : "";
  if (!nome) return { vazio: true };

  let q = supabase
    .from("hub_obra_itens")
    .select("id, codigo, nome, area_codigo, area_label")
    .eq("obra_id", obraId)
    .eq("tenant_id", tenant)
    .eq("ativo", true)
    .ilike("nome", `%${nome}%`)
    .limit(10);
  const area = typeof args.area_codigo === "string" ? args.area_codigo.trim() : "";
  if (area) q = q.eq("area_codigo", area);

  const { data, error } = await q;
  if (error && ehTabelaAusente(error)) return { migracaoPendente: true };
  const linhas = data ?? [];
  if (linhas.length === 0) return { vazio: true };
  if (linhas.length === 1) {
    return { item: { id: String(linhas[0].id), nome: String(linhas[0].nome) } };
  }
  return {
    ambiguidade: linhas.map((l) => ({
      id: String(l.id),
      codigo: String(l.codigo),
      nome: String(l.nome),
      area_label: (l.area_label as string | null) ?? null,
    })),
  };
}

export async function executarFerramentaObraRestricao(
  toolName: "hub_obra_bloqueios_listar" | "hub_obra_bloqueio_criar" | "hub_obra_bloqueio_resolver",
  args: Record<string, unknown>,
  ctx: ObraCtx,
  supabase: SupabaseClient
): Promise<string> {
  const tenant = (ctx.tenantId && ctx.tenantId.trim()) || defaultTenantId();
  const obraId = typeof args.obra_id === "string" ? args.obra_id.trim() : "";

  switch (toolName) {
    // ── LEITURA: bloqueios do dia (view unificada — dado fino sem duplicar E2) ──
    case "hub_obra_bloqueios_listar": {
      let q = supabase
        .from("vw_hub_obra_bloqueios_hoje")
        .select(
          "fonte, restricao_id, obra_id, obra_titulo, item_id, tipo, status, titulo, responsavel_nome, prazo_resolucao, impacto, impacto_dias, acao_sugerida"
        )
        .eq("tenant_id", tenant)
        .limit(80);
      if (obraId) q = q.eq("obra_id", obraId);
      if (typeof args.tipo === "string" && isTipoRestricao(args.tipo)) {
        q = q.eq("tipo", args.tipo);
      }
      const { data, error } = await q;
      if (error) {
        if (ehTabelaAusente(error)) {
          return JSON.stringify({ erro: "migracao_e3_pendente", bloqueios: [], total: 0 });
        }
        return JSON.stringify({ erro: "supabase", detalhe: error.message });
      }
      const linhas = data ?? [];
      return JSON.stringify({
        total: linhas.length,
        bloqueios: linhas.slice(0, 40).map((b) => ({
          restricao_id: b.restricao_id,
          fonte: b.fonte,
          obra: b.obra_titulo,
          tipo: b.tipo,
          item: b.titulo,
          impacto: b.impacto,
          impacto_dias: b.impacto_dias,
          responsavel: b.responsavel_nome,
          prazo: b.prazo_resolucao,
          acao_sugerida: b.acao_sugerida,
        })),
      });
    }

    // ── ESCRITA: criar bloqueio (gate sempre) ──
    case "hub_obra_bloqueio_criar": {
      const gate = recusaSeCanalWhatsapp(ctx);
      if (gate) return gate;
      if (!obraId) return JSON.stringify({ erro: "obra_id_ausente", nota: "Abra a ficha da obra." });
      if (!(await obraDoTenant(supabase, obraId, tenant))) {
        return JSON.stringify({ erro: "obra_nao_encontrada", obra_id: obraId });
      }
      const tipoRaw = typeof args.tipo === "string" ? args.tipo.trim() : "";
      if (!isTipoRestricao(tipoRaw)) {
        return JSON.stringify({
          erro: "tipo_invalido",
          nota: "Diga o que falta: material, pessoa, documento, ferramenta ou equipamento.",
        });
      }
      const tipo: TipoRestricao = tipoRaw;

      // Resolve o item (se informado nome/id). Ambiguidade → pede para escolher.
      const temAlvoItem =
        (typeof args.item_id === "string" && args.item_id.trim()) ||
        (typeof args.nome === "string" && args.nome.trim());
      let itemId: string | null = null;
      if (temAlvoItem) {
        const r = await resolverItem(supabase, tenant, obraId, args);
        if ("migracaoPendente" in r) {
          return JSON.stringify({ erro: "migracao_e2_pendente", nota: "Itens ainda não ativos nesta base." });
        }
        if ("vazio" in r) return JSON.stringify({ erro: "item_nao_encontrado", nota: "Não achei esse item." });
        if ("ambiguidade" in r) return JSON.stringify({ precisa_desambiguar: true, opcoes: r.ambiguidade });
        itemId = r.item.id;
      }

      // Com item: promove (idempotente) + liga o boolean falta_* de E2.
      if (itemId) {
        const { data: promovidoId, error: rpcErr } = await supabase.rpc("hub_obra_restricao_promover", {
          p_item_id: itemId,
          p_tipo: tipo,
          p_origem: "ia",
        });
        if (rpcErr) {
          if (ehTabelaAusente(rpcErr)) {
            return JSON.stringify({ erro: "migracao_e3_pendente", nota: "Restrições ainda não ativas nesta base." });
          }
          return JSON.stringify({ erro: "supabase", detalhe: rpcErr.message });
        }
        const campo = booleanDoTipo(tipo);
        if (campo) {
          await supabase
            .from("hub_obra_itens")
            .update({ [campo]: true, atualizado_em: new Date().toISOString() })
            .eq("id", itemId)
            .eq("obra_id", obraId)
            .eq("tenant_id", tenant);
        }
        return JSON.stringify({
          ok: true,
          restricao_id: promovidoId,
          tipo,
          item_id: itemId,
          nota: `${APRESENTACAO_TIPO[tipo].icone} Bloqueio (${APRESENTACAO_TIPO[tipo].label}) registrado no item.`,
        });
      }

      // Sem item: bloqueio de frente/obra — INSERT direto.
      const frenteId = typeof args.frente_id === "string" && args.frente_id.trim() ? args.frente_id.trim() : null;
      const { data, error } = await supabase
        .from("hub_obra_restricoes")
        .insert({
          obra_id: obraId,
          tenant_id: tenant,
          item_id: null,
          frente_id: frenteId,
          tipo,
          status: "aberta",
          titulo: typeof args.titulo === "string" ? args.titulo.trim() || null : null,
          origem: "ia",
          impacto: tipo === "documento" ? "trava" : "atrasa",
        })
        .select("id, tipo, status")
        .single();
      if (error) {
        if (ehTabelaAusente(error)) {
          return JSON.stringify({ erro: "migracao_e3_pendente", nota: "Restrições ainda não ativas nesta base." });
        }
        return JSON.stringify({ erro: "supabase", detalhe: error.message });
      }
      return JSON.stringify({ ok: true, restricao: data });
    }

    // ── ESCRITA: resolver bloqueio (gate REFORÇADO) ──
    case "hub_obra_bloqueio_resolver": {
      const gate = recusaSeCanalWhatsapp(ctx);
      if (gate) return gate;
      if (!obraId) return JSON.stringify({ erro: "obra_id_ausente", nota: "Abra a ficha da obra." });
      if (!(await obraDoTenant(supabase, obraId, tenant))) {
        return JSON.stringify({ erro: "obra_nao_encontrada", obra_id: obraId });
      }

      // Identifica a restrição: por restricao_id (preferido) OU por item+tipo (resolve a ativa).
      const restricaoIdArg = typeof args.restricao_id === "string" ? args.restricao_id.trim() : "";
      let alvo: { id: string; item_id: string | null; tipo: string; sst: boolean; origem: string | null } | null = null;

      if (restricaoIdArg) {
        const { data, error } = await supabase
          .from("hub_obra_restricoes")
          .select("id, item_id, tipo, sst, origem, status")
          .eq("id", restricaoIdArg)
          .eq("obra_id", obraId)
          .eq("tenant_id", tenant)
          .maybeSingle();
        if (error && ehTabelaAusente(error)) {
          return JSON.stringify({ erro: "migracao_e3_pendente", nota: "Restrições ainda não ativas nesta base." });
        }
        if (data) {
          alvo = {
            id: String(data.id),
            item_id: (data.item_id as string | null) ?? null,
            tipo: String(data.tipo),
            sst: data.sst === true,
            origem: (data.origem as string | null) ?? null,
          };
        }
      } else {
        // por item + tipo: resolve a restrição ATIVA daquele (item,tipo).
        const tipoRaw = typeof args.tipo === "string" ? args.tipo.trim() : "";
        if (!isTipoRestricao(tipoRaw)) {
          return JSON.stringify({
            erro: "tipo_invalido",
            nota: "Diga qual bloqueio resolver (material, pessoa, documento…) ou o id.",
          });
        }
        const r = await resolverItem(supabase, tenant, obraId, args);
        if ("migracaoPendente" in r) {
          return JSON.stringify({ erro: "migracao_e2_pendente", nota: "Itens ainda não ativos nesta base." });
        }
        if ("vazio" in r) return JSON.stringify({ erro: "item_nao_encontrado", nota: "Não achei esse item." });
        if ("ambiguidade" in r) return JSON.stringify({ precisa_desambiguar: true, opcoes: r.ambiguidade });
        const { data, error } = await supabase
          .from("hub_obra_restricoes")
          .select("id, item_id, tipo, sst, origem")
          .eq("obra_id", obraId)
          .eq("tenant_id", tenant)
          .eq("item_id", r.item.id)
          .eq("tipo", tipoRaw)
          .in("status", ["aberta", "em_resolucao", "reaberta"])
          .order("criado_em", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error && ehTabelaAusente(error)) {
          return JSON.stringify({ erro: "migracao_e3_pendente", nota: "Restrições ainda não ativas nesta base." });
        }
        if (data) {
          alvo = {
            id: String(data.id),
            item_id: (data.item_id as string | null) ?? null,
            tipo: String(data.tipo),
            sst: data.sst === true,
            origem: (data.origem as string | null) ?? null,
          };
        }
      }

      if (!alvo) {
        return JSON.stringify({ erro: "bloqueio_nao_encontrado", nota: "Não achei um bloqueio ativo assim." });
      }

      // §19: SST (documento) NÃO resolve por voz — só regularização auditada.
      if (ehSstReadonly(alvo)) {
        return JSON.stringify({
          erro: "sst_readonly",
          nota: "Documento de SST: a resolução exige regularização auditada (não por voz).",
        });
      }

      const { error: errUp } = await supabase
        .from("hub_obra_restricoes")
        .update({
          status: "resolvida",
          resolvido_em: new Date().toISOString(),
          resolvido_por: "copiloto",
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", alvo.id)
        .eq("obra_id", obraId)
        .eq("tenant_id", tenant);
      if (errUp) {
        if (ehTabelaAusente(errUp)) {
          return JSON.stringify({ erro: "migracao_e3_pendente", nota: "Restrições ainda não ativas nesta base." });
        }
        return JSON.stringify({ erro: "supabase", detalhe: errUp.message });
      }

      // Sync explícito E2: limpa o boolean falta_* do item (não derruba se falhar).
      if (alvo.item_id) {
        const campo = booleanDoTipo(alvo.tipo as TipoRestricao);
        if (campo) {
          await supabase
            .from("hub_obra_itens")
            .update({ [campo]: false, atualizado_em: new Date().toISOString() })
            .eq("id", alvo.item_id)
            .eq("obra_id", obraId)
            .eq("tenant_id", tenant);
        }
      }
      return JSON.stringify({ ok: true, restricao_id: alvo.id, status: "resolvida" });
    }

    default:
      return JSON.stringify({ erro: "ferramenta_restricao_desconhecida", nome: toolName });
  }
}
