/**
 * E4 — CRONOGRAMA + CURVA-S da obra: GET monta {baseline, planejado[], executado[], hoje, kpis}.
 * A curva "pendura no PESO do item de escopo" (design §7 Fase 4): o EXECUTADO ao vivo sai do avanço
 * ponderado dos itens (lib/obras/escopo → cockpitDe/avancoPonderado), separando físico × financeiro.
 *
 * SEGURANÇA (regra sistêmica E0/E2/E5/E6/E7): crmDb() é service-role e BYPASSA RLS — o isolamento
 * depende 100% do filtro no código. Toda query filtra `.eq("tenant_id", g.ctx.tenantId)` PURO
 * (NUNCA `.or('...is.null')`) E `.eq("obra_id", obraId)`. A obra é validada por POSSE (404 se o
 * tenant não bate). tenant_id vem SEMPRE da sessão (requireCrm*), nunca do body.
 *
 * TOLERÂNCIA (design §7): as tabelas E4 podem não existir ainda (migração na janela do dono).
 *   - hub_obra_curva_baseline/pontos ausentes → planejado LINEAR derivado de hub_obras
 *     (data_inicio/data_previsao_fim, que sempre existem) → senão eixo ordinal; migracao_pendente=true.
 *   - hub_obra_avanco_diario ausente/vazio → executado = 1 ponto AO VIVO do avanço ponderado.
 *   - hub_obra_itens ausente (E2 pendente) → avanço 0, curva planejada honesta, migracao_pendente=true.
 *  Nunca quebra: sempre devolve uma curva renderizável + os flags do que falta.
 *
 * SEM ESCRITA AQUI: registrar snapshot/baseline é outro endpoint (futuro). Este GET é leitura pura.
 */

import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { isMissingPgColumn } from "@/lib/tenant-default";
import { personaDaSessao } from "@/lib/obras/persona-escopo";
import {
  calcularItem,
  cockpitDe,
  personaPodeVerPreco,
  type ItemEscopoInput,
  type ItemEscopoCalc,
} from "@/lib/obras/escopo";
import {
  montarCurvaS,
  calcularKpis,
  type BaselineInput,
  type PontoPlanejadoInput,
  type SnapshotExecutadoInput,
} from "@/lib/obras/cronograma";

type Params = { params: Promise<{ id: string }> };

const AVISO_E4 =
  "Cronograma planejado completo (baseline + curva) fica disponível após aplicar a migração E4 (janela do dono). O avanço executado já funciona.";
const AVISO_E2 = "Itens & escopo ainda não ativos (migração E2 pendente — janela do dono).";

/** Tabela/relação ausente (vs. coluna ausente, tratado à parte). */
function ehRelacaoAusente(error: { message?: string } | null): boolean {
  if (!error) return false;
  return /relation .*does not exist/i.test(error.message ?? "");
}

type ObraDatas = { bdi: number | null; data_inicio: string | null; data_previsao_fim: string | null };

/**
 * Confirma posse + traz as datas-base da obra (fallback de baseline quando E4 não aplicada).
 * crmDb() é service-role (RLS bypassada): a checagem explícita é a única proteção. tenant NULL → 404.
 */
async function assertObraDoTenant(
  obraId: string,
  tenantId: string
): Promise<{ obra: ObraDatas } | { erro: NextResponse }> {
  const { data } = await crmDb()
    .from("hub_obras")
    .select("id, tenant_id, bdi_fator, data_inicio, data_previsao_fim")
    .eq("id", obraId)
    .maybeSingle();
  if (!data || (data as Record<string, unknown>).tenant_id !== tenantId) {
    return { erro: NextResponse.json({ error: "Obra não encontrada" }, { status: 404 }) };
  }
  const r = data as Record<string, unknown>;
  return {
    obra: {
      bdi: typeof r.bdi_fator === "number" ? (r.bdi_fator as number) : null,
      data_inicio: (r.data_inicio as string | null) ?? null,
      data_previsao_fim: (r.data_previsao_fim as string | null) ?? null,
    },
  };
}

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: NextRequest, { params }: Params) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id: obraId } = await params;
  const posse = await assertObraDoTenant(obraId, g.ctx.tenantId);
  if ("erro" in posse) return posse.erro;
  const obra = posse.obra;

  const tenantId = g.ctx.tenantId;
  const supabase = crmDb();
  const persona = personaDaSessao(g.ctx.role);
  const verPreco = personaPodeVerPreco(persona); // financeiro só p/ quem vê preço

  let migracaoE4Pendente = false;
  let migracaoE2Pendente = false;

  // ── 1) Avanço ao vivo (físico ponderado) a partir dos itens de escopo (E2). ──
  // Lê base + custos E7 (tolerante): com custo, o avanço pondera por preço; sem custo, média simples.
  // O financeiro ao vivo = mesmo avanço ponderado (modo avanço-só) — o snapshot E4 é que separa de fato.
  let fisicoAoVivo = 0;
  let financeiroAoVivo: number | null = null;
  {
    const COLS_BASE = "id, parent_id, ambiente, disciplina_slug, quantidade, pct_avanco, ativo";
    const COLS_E7 = "custo_locacao_frete, custo_material, custo_mao_obra, bdi_fator";
    let resp = (await supabase
      .from("hub_obra_itens")
      .select(`${COLS_BASE}, ${COLS_E7}`)
      .eq("obra_id", obraId)
      .eq("tenant_id", tenantId)
      .eq("ativo", true)
      .limit(2000)) as {
      data: Array<Record<string, unknown>> | null;
      error: { message?: string; code?: string } | null;
    };

    let comE7 = true;
    if (
      resp.error &&
      !ehRelacaoAusente(resp.error) &&
      (isMissingPgColumn(resp.error, "custo_locacao_frete") ||
        isMissingPgColumn(resp.error, "custo_material") ||
        isMissingPgColumn(resp.error, "custo_mao_obra") ||
        isMissingPgColumn(resp.error, "bdi_fator") ||
        isMissingPgColumn(resp.error))
    ) {
      comE7 = false;
      resp = (await supabase
        .from("hub_obra_itens")
        .select(COLS_BASE)
        .eq("obra_id", obraId)
        .eq("tenant_id", tenantId)
        .eq("ativo", true)
        .limit(2000)) as {
        data: Array<Record<string, unknown>> | null;
        error: { message?: string; code?: string } | null;
      };
    }

    if (resp.error) {
      if (ehRelacaoAusente(resp.error)) {
        migracaoE2Pendente = true; // sem itens: avanço 0, a curva planejada ainda renderiza
      } else {
        return NextResponse.json({ error: resp.error.message }, { status: 500 });
      }
    } else {
      const rows = (resp.data ?? []) as Array<Record<string, unknown>>;
      const obraBdi = obra.bdi ?? 1.0;
      const itensInput: ItemEscopoInput[] = rows.map((r) => ({
        id: String(r.id),
        parent_id: (r.parent_id as string | null) ?? null,
        ambiente: (r.ambiente as string | null) ?? null,
        disciplina_slug: (r.disciplina_slug as string | null) ?? null,
        quantidade: numOrNull(r.quantidade),
        pct_avanco: numOrNull(r.pct_avanco),
        custo_locacao_frete: comE7 ? numOrNull(r.custo_locacao_frete) : null,
        custo_material: comE7 ? numOrNull(r.custo_material) : null,
        custo_mao_obra: comE7 ? numOrNull(r.custo_mao_obra) : null,
        bdi_fator: comE7 ? numOrNull(r.bdi_fator) : null,
      }));
      const itensCalc: ItemEscopoCalc[] = itensInput.map((it) => calcularItem(it, obraBdi));
      const cockpit = cockpitDe(itensCalc);
      fisicoAoVivo = cockpit.avanco; // avanço físico ponderado pelo peso financeiro (só raízes)
      // Financeiro ao vivo = mesmo avanço (modo avanço-só, honesto). O snapshot E4 separa de verdade.
      financeiroAoVivo = cockpit.avanco;
    }
  }

  // ── 2) Baseline + pontos planejados (E4). Ausência → fallback linear de hub_obras. ──
  let baseline: BaselineInput = null;
  let baselineId: string | null = null;
  let pontosPlanejados: PontoPlanejadoInput[] = [];

  const respBaseline = (await supabase
    .from("hub_obra_curva_baseline")
    .select("id, data_inicio, data_fim")
    .eq("obra_id", obraId)
    .eq("tenant_id", tenantId)
    .eq("vigente", true)
    .maybeSingle()) as {
    data: Record<string, unknown> | null;
    error: { message?: string; code?: string } | null;
  };

  if (respBaseline.error && ehRelacaoAusente(respBaseline.error)) {
    migracaoE4Pendente = true; // tabela E4 não existe → fallback linear de hub_obras
  } else if (!respBaseline.error && respBaseline.data) {
    baselineId = String(respBaseline.data.id);
    baseline = {
      data_inicio: (respBaseline.data.data_inicio as string | null) ?? null,
      data_fim: (respBaseline.data.data_fim as string | null) ?? null,
    };
  }

  // Pontos planejados da baseline vigente (só se a baseline E4 existe).
  if (baselineId) {
    const respPontos = (await supabase
      .from("hub_obra_curva_pontos")
      .select("semana, data, planejado_pct_fisico, planejado_pct_financeiro")
      .eq("baseline_id", baselineId)
      .eq("tenant_id", tenantId)
      .order("semana", { ascending: true })
      .limit(520)) as {
      data: Array<Record<string, unknown>> | null;
      error: { message?: string; code?: string } | null;
    };
    if (!respPontos.error && respPontos.data) {
      pontosPlanejados = respPontos.data.map((p) => ({
        semana: Number(p.semana ?? 0),
        data: (p.data as string | null) ?? null,
        planejado_pct_fisico: numOrNull(p.planejado_pct_fisico),
        planejado_pct_financeiro: numOrNull(p.planejado_pct_financeiro),
      }));
    }
  }

  // Sem baseline E4: usa as datas da própria obra como linha-base do planejado LINEAR (honesto).
  if (!baseline) {
    baseline = { data_inicio: obra.data_inicio, data_fim: obra.data_previsao_fim };
  }

  // ── 3) Snapshots executados (E4 append-only). Ausência/vazio → executado ao vivo (1 ponto). ──
  let snapshots: SnapshotExecutadoInput[] = [];
  const respSnaps = (await supabase
    .from("hub_obra_avanco_diario")
    .select("data, pct_fisico, pct_financeiro")
    .eq("obra_id", obraId)
    .eq("tenant_id", tenantId)
    .order("data", { ascending: true })
    .limit(2000)) as {
    data: Array<Record<string, unknown>> | null;
    error: { message?: string; code?: string } | null;
  };

  if (respSnaps.error && ehRelacaoAusente(respSnaps.error)) {
    migracaoE4Pendente = true; // append-only não existe → executado ao vivo
  } else if (!respSnaps.error && respSnaps.data) {
    snapshots = respSnaps.data.map((s) => ({
      data: (s.data as string | null) ?? null,
      pct_fisico: numOrNull(s.pct_fisico),
      pct_financeiro: numOrNull(s.pct_financeiro),
    }));
  }

  // ── 4) Monta a curva + KPIs (lógica pura). ──
  const hoje = hojeISO();
  const curva = montarCurvaS({
    baseline,
    pontosPlanejados,
    snapshots,
    fisicoAoVivo,
    financeiroAoVivo,
    hojeISO: hoje,
    semanasFallback: 8,
  });

  const kpis = calcularKpis(curva.planejado, curva.executado, baseline, hoje, "fisico");

  // DEFESA EM PROFUNDIDADE: persona que não vê preço (arquiteto) não recebe a faixa financeira.
  // Zera o financeiro de cada ponto + os KPIs financeiros (mantém a forma p/ a UI não quebrar).
  const planejado = verPreco
    ? curva.planejado
    : curva.planejado.map((p) => ({ ...p, financeiro: 0 }));
  const executado = verPreco
    ? curva.executado
    : curva.executado.map((p) => ({ ...p, financeiro: 0 }));
  const kpisOut = verPreco ? kpis : { ...kpis, financeiroAtual: 0 };

  const avisos: string[] = [];
  if (migracaoE4Pendente) avisos.push(AVISO_E4);
  if (migracaoE2Pendente) avisos.push(AVISO_E2);

  return NextResponse.json({
    migracao_pendente: migracaoE4Pendente || migracaoE2Pendente,
    migracao_e4_pendente: migracaoE4Pendente,
    migracao_e2_pendente: migracaoE2Pendente,
    aviso: avisos.length ? avisos.join(" ") : null,
    persona,
    ver_financeiro: verPreco,
    baseline: { data_inicio: baseline.data_inicio, data_fim: baseline.data_fim },
    planejado,
    executado,
    hoje_index: curva.hojeIndex,
    hoje,
    kpis: kpisOut,
  });
}
