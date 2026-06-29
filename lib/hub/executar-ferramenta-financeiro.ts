/**
 * E6 — Execução das 2 ferramentas de IA de Financeiro (resumo + preparar pagamento).
 *
 * HUMANO APROVA O DINHEIRO (regra inegociável):
 *  - LEITURA (hub_obra_financeiro_resumo) é livre (sem gate canal_whatsapp);
 *  - ESCRITA (hub_obra_pagamento_preparar) só PREPARA: cria o pagamento + enfileira a APROVAÇÃO DUPLA
 *    (arquitetura + Hub = DOIS registros tipados em hub_aprovacoes). NUNCA aprova nem libera o escrow —
 *    isso é decisão humana com as duas chaves na tela. Aprovar/liberar por voz é PROIBIDO por design.
 *    Recusa no canal_whatsapp (é do copiloto interno) + segue sob o gate do copiloto (HMAC+confirmação).
 *  - tenant vem de ctx.tenantId (sessão), nunca do body; filtro `.eq("tenant_id")` PURO + posse da obra.
 *
 * Reuso: lib/obras/financeiro (enums/derivações puras), vw_hub_obra_compatibilizacao + hub_obra_pagamentos
 * (leitura), hub_aprovacoes (gate dourado — DOIS registros, não JSONB). Não duplica nenhuma tool existente.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultTenantId } from "@/lib/tenant-default";
import {
  isTipoContrato,
  isTipoPagamento,
  baldePagamento,
  resumoFinanceiroVazio,
  type TipoContrato,
} from "@/lib/obras/financeiro";

type ObraCtx = { tenantId?: string; modoOperacao?: string | null; userId?: string };

function recusaSeCanalWhatsapp(ctx: ObraCtx): string | null {
  if (ctx.modoOperacao === "canal_whatsapp") {
    return JSON.stringify({
      erro: "ferramenta_escrita_obra_indisponivel_no_whatsapp",
      nota: "Pagamentos são tratados pelo copiloto interno, não pelo atendimento WhatsApp.",
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

async function obraComTipoContrato(
  supabase: SupabaseClient,
  obraId: string,
  tenant: string
): Promise<{ ok: true; tipo_contrato: TipoContrato } | { ok: false }> {
  if (!obraId) return { ok: false };
  const { data } = await supabase
    .from("hub_obras")
    .select("id, tenant_id, tipo_contrato")
    .eq("id", obraId)
    .maybeSingle();
  if (!data || data.tenant_id !== tenant) return { ok: false };
  const tipo =
    typeof data.tipo_contrato === "string" && isTipoContrato(data.tipo_contrato)
      ? data.tipo_contrato
      : "administracao";
  return { ok: true, tipo_contrato: tipo };
}

export async function executarFerramentaFinanceiro(
  toolName: "hub_obra_financeiro_resumo" | "hub_obra_pagamento_preparar",
  args: Record<string, unknown>,
  ctx: ObraCtx,
  supabase: SupabaseClient
): Promise<string> {
  const tenant = (ctx.tenantId && ctx.tenantId.trim()) || defaultTenantId();
  const obraId = typeof args.obra_id === "string" ? args.obra_id.trim() : "";

  switch (toolName) {
    // ── LEITURA: resumo financeiro da obra ──
    case "hub_obra_financeiro_resumo": {
      if (!obraId) {
        return JSON.stringify({ erro: "obra_id_ausente", nota: "Abra a ficha da obra para ver o financeiro." });
      }
      const obra = await obraComTipoContrato(supabase, obraId, tenant);
      if (!obra.ok) return JSON.stringify({ erro: "obra_nao_encontrada", obra_id: obraId });

      const hojeISO = new Date().toISOString().slice(0, 10);
      const resumo = resumoFinanceiroVazio();

      const { data: orcamentos, error: errOrc } = await supabase
        .from("hub_obra_orcamentos")
        .select("valor_total, status")
        .eq("obra_id", obraId)
        .eq("tenant_id", tenant)
        .limit(500);
      if (errOrc && ehTabelaAusente(errOrc)) {
        return JSON.stringify({ erro: "migracao_e6_pendente", nota: "Financeiro ainda não ativo nesta base." });
      }
      for (const o of orcamentos ?? []) {
        const v = Number(o.valor_total ?? 0);
        if (String(o.status) !== "cancelado") resumo.orcado += Number.isFinite(v) ? v : 0;
        if (String(o.status) === "aprovado") resumo.aprovado += Number.isFinite(v) ? v : 0;
      }

      const { data: pagamentos } = await supabase
        .from("hub_obra_pagamentos")
        .select("status, valor, valor_retencao, data_vencimento, escrow_liberado")
        .eq("obra_id", obraId)
        .eq("tenant_id", tenant)
        .in("status", ["liberado", "autorizado", "em_custodia"])
        .limit(500);
      for (const p of pagamentos ?? []) {
        const liq = Number(p.valor ?? 0) - Number(p.valor_retencao ?? 0);
        const valor = Number.isFinite(liq) ? liq : 0;
        const balde = baldePagamento(String(p.status), p.data_vencimento as string | null, hojeISO);
        if (balde === "a_pagar") resumo.a_pagar += valor;
        else if (balde === "vencendo_7d") resumo.vencendo_7d += valor;
        else if (balde === "atrasado") resumo.atrasado += valor;
        if (String(p.status) === "liberado" && !p.escrow_liberado) resumo.aguarda_2a_chave += valor;
      }

      const { data: conta } = await supabase
        .from("hub_obra_escrow_contas")
        .select("saldo_custodia, saldo_liberado")
        .eq("obra_id", obraId)
        .eq("tenant_id", tenant)
        .maybeSingle();
      if (conta) {
        resumo.em_custodia = Number(conta.saldo_custodia ?? 0);
        resumo.liberado = Number(conta.saldo_liberado ?? 0);
      }

      // Cobertura (só administração — item a item).
      let coberturaResumo: { coberto: number; parcial: number; sem_orcamento: number } | null = null;
      if (obra.tipo_contrato === "administracao") {
        const { data: cov } = await supabase
          .from("vw_hub_obra_compatibilizacao")
          .select("estado_cobertura")
          .eq("obra_id", obraId)
          .eq("tenant_id", tenant)
          .limit(1000);
        if (cov) {
          coberturaResumo = { coberto: 0, parcial: 0, sem_orcamento: 0 };
          for (const c of cov) {
            const e = String(c.estado_cobertura);
            if (e === "coberto") coberturaResumo.coberto += 1;
            else if (e === "parcial") coberturaResumo.parcial += 1;
            else if (e === "sem_orcamento") coberturaResumo.sem_orcamento += 1;
          }
        }
      }

      return JSON.stringify({
        ok: true,
        tipo_contrato: obra.tipo_contrato,
        resumo,
        cobertura: coberturaResumo,
        nota:
          obra.tipo_contrato === "administracao"
            ? "Administração: cliente vê valor unitário (gestão aberta)."
            : "Preço fechado (turn-key): só totais por etapa.",
      });
    }

    // ── ESCRITA: preparar pagamento + enfileirar a DUPLA aprovação (nunca aprova/libera) ──
    case "hub_obra_pagamento_preparar": {
      const gate = recusaSeCanalWhatsapp(ctx);
      if (gate) return gate;
      if (!obraId) return JSON.stringify({ erro: "obra_id_ausente", nota: "Abra a ficha da obra." });
      const obra = await obraComTipoContrato(supabase, obraId, tenant);
      if (!obra.ok) return JSON.stringify({ erro: "obra_nao_encontrada", obra_id: obraId });

      const titulo = typeof args.titulo === "string" ? args.titulo.trim() : "";
      if (!titulo) return JSON.stringify({ erro: "titulo_ausente", nota: "Diga o que é o pagamento (ex.: Medição 3)." });
      const valor = Number(args.valor);
      if (!Number.isFinite(valor) || valor <= 0) {
        return JSON.stringify({ erro: "valor_invalido", nota: "Diga o valor (ex.: 84000)." });
      }
      const dataVenc = typeof args.data_vencimento === "string" ? args.data_vencimento.trim() : "";
      if (!dataVenc) return JSON.stringify({ erro: "vencimento_ausente", nota: "Diga a data de vencimento." });

      const tipo = typeof args.tipo === "string" && isTipoPagamento(args.tipo) ? args.tipo : "medicao";
      const justificativa =
        typeof args.adiantamento_justificativa === "string" ? args.adiantamento_justificativa.trim() : "";
      if (tipo === "adiantamento" && !justificativa) {
        return JSON.stringify({
          erro: "adiantamento_exige_justificativa",
          nota: "Adiantamento exige justificativa explícita — diga o motivo.",
        });
      }
      const orcamentoId =
        typeof args.orcamento_id === "string" && args.orcamento_id.trim() ? args.orcamento_id.trim() : null;

      // Status inicial: bloqueado (regra do design); liberado se houver orçamento aprovado, ou se
      // for avulso/reembolso/adiantamento (sem escrow / justificado). NUNCA aprovado por aqui.
      let statusInicial = "bloqueado";
      if (orcamentoId) {
        const { data: orc } = await supabase
          .from("hub_obra_orcamentos")
          .select("id, status")
          .eq("id", orcamentoId)
          .eq("tenant_id", tenant)
          .maybeSingle();
        if (orc && orc.status === "aprovado") statusInicial = "liberado";
      } else if (tipo === "avulso" || tipo === "reembolso" || tipo === "adiantamento") {
        statusInicial = "liberado";
      }

      const { data: pag, error: errPag } = await supabase
        .from("hub_obra_pagamentos")
        .insert({
          obra_id: obraId,
          tenant_id: tenant,
          orcamento_id: orcamentoId,
          titulo: titulo.slice(0, 240),
          tipo,
          valor,
          data_vencimento: dataVenc,
          status: statusInicial,
          tipo_contrato: obra.tipo_contrato,
          adiantamento_justificativa: tipo === "adiantamento" ? justificativa : null,
          criado_por: ctx.userId ?? "copiloto",
        })
        .select("id, titulo, valor, status")
        .single();

      if (errPag) {
        if (ehTabelaAusente(errPag)) {
          return JSON.stringify({ erro: "migracao_e6_pendente", nota: "Financeiro ainda não ativo nesta base." });
        }
        return JSON.stringify({ erro: "supabase", detalhe: errPag.message });
      }

      // Se bloqueado, o orçamento da frente ainda não foi aprovado — a dupla aprovação não pode abrir.
      if (statusInicial === "bloqueado") {
        return JSON.stringify({
          ok: true,
          bloqueado: true,
          pagamento: { id: pag.id, titulo: pag.titulo, status: pag.status },
          nota: `Pagamento ${pag.titulo} criado, mas BLOQUEADO: o orçamento da frente ainda não foi aprovado. Aprove o orçamento primeiro.`,
        });
      }

      // Enfileira a DUPLA aprovação (arquitetura + Hub) = DOIS registros tipados em hub_aprovacoes.
      const base = {
        valor,
        valor_envolvido: valor,
        status: "pendente",
        tenant_id: tenant,
        obra_id: obraId,
        referencia_id: String(pag.id),
        solicitado_por: ctx.userId ?? "copiloto",
      };
      const { data: aprArq } = await supabase
        .from("hub_aprovacoes")
        .insert({ ...base, tipo: "pagamento_obra_arq", titulo: `Pagamento: ${pag.titulo}`, descricao: "Aprovação da ARQUITETURA (chave 1 de 2).", dados: { pagamento_id: pag.id, obra_id: obraId, papel: "arquitetura" } })
        .select("id")
        .single();
      const { data: aprHub } = await supabase
        .from("hub_aprovacoes")
        .insert({ ...base, tipo: "pagamento_obra_hub", titulo: `Pagamento: ${pag.titulo}`, descricao: "Aprovação do HUB (chave 2 de 2 — o juiz).", dados: { pagamento_id: pag.id, obra_id: obraId, papel: "hub" } })
        .select("id")
        .single();

      if (aprArq?.id && aprHub?.id) {
        await supabase
          .from("hub_obra_pagamentos")
          .update({ aprovacao_arq_id: aprArq.id, aprovacao_hub_id: aprHub.id })
          .eq("id", pag.id)
          .eq("tenant_id", tenant);
      }

      return JSON.stringify({
        ok: true,
        pagamento: { id: pag.id, titulo: pag.titulo, valor: pag.valor, status: pag.status },
        nota: `💳 Pagamento ${pag.titulo} (R$${valor.toLocaleString("pt-BR")}) preparado e enviado para APROVAÇÃO DUPLA (arquitetura + Hub). Liberar o dinheiro é decisão humana com as duas chaves na tela — NUNCA por voz.`,
      });
    }

    default:
      return JSON.stringify({ erro: "ferramenta_financeiro_desconhecida", nome: toolName });
  }
}
