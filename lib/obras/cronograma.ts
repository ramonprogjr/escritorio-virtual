/**
 * E4 — CRONOGRAMA + CURVA-S: lógica PURA (sem I/O). A curva "pendura no PESO do item de escopo".
 *
 * Fonte única em runtime = o endpoint /api/crm/obras/[id]/cronograma, que lê:
 *   - a baseline + pontos planejados (hub_obra_curva_baseline/pontos, E4) quando aplicada;
 *   - os snapshots executados (hub_obra_avanco_diario, E4 append-only) quando há;
 *   - SEMPRE o avanço ponderado dos itens (lib/obras/escopo → avancoPonderado/cockpitDe) como
 *     fonte do EXECUTADO ao vivo (degrade honesto quando o append-only ainda está vazio).
 *
 * DECISÃO TRAVADA pelo dono (29/jun — §9 #4): avanço POR ITEM; a curva pendura no PESO derivado.
 *   pct_fisico = avanço ponderado pelo peso financeiro; pct_financeiro = peso financeiro realizado.
 *   Os DOIS são SEPARADOS. Sem E4 aplicado, degrada para "avanço-só" (físico = financeiro).
 *
 * Este módulo é PURO e testável: gera a curva planejada (linear quando não há pontos), normaliza o
 * executado, calcula o ponto "hoje" e os KPIs (desvio vs planejado, previsão de término). Sem datas,
 * degrada para um eixo ordinal honesto (semana 0..N) sem inventar calendário.
 */

// ── Tipos do payload da curva (o que o endpoint devolve / a UI consome) ───────
export type PontoCurva = {
  semana: number;
  /** ISO date (YYYY-MM-DD) quando há baseline/datas; null no modo ordinal sem calendário. */
  data: string | null;
  fisico: number; // 0..100
  financeiro: number; // 0..100
};

export type CurvaS = {
  planejado: PontoCurva[];
  executado: PontoCurva[];
  /** Índice do ponto "hoje" no eixo (ou o mais próximo); -1 se indeterminável. */
  hojeIndex: number;
};

export type KpisCronograma = {
  /** Avanço físico atual (último executado), 0..100. */
  fisicoAtual: number;
  /** Avanço financeiro atual (último executado), 0..100. */
  financeiroAtual: number;
  /** % planejado para hoje (físico), 0..100; null se não há planejado/calendário. */
  planejadoHoje: number | null;
  /** desvio = físicoAtual − planejadoHoje (positivo = adiantado; negativo = atrasado); null sem plano. */
  desvioPct: number | null;
  /** Rótulo honesto do status de prazo. */
  statusPrazo: "adiantado" | "no_prazo" | "atrasado" | "indefinido";
  /** Previsão de término (ISO date) projetando o ritmo atual; null sem datas/ritmo. */
  previsaoTermino: string | null;
};

// ── Helpers de data (sem dependência externa; UTC para estabilidade no teste) ──
function parseISO(d: string | null | undefined): Date | null {
  if (!d || typeof d !== "string") return null;
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(dt.getTime()) ? null : dt;
}
function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}
function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}
export function clampPct(v: number | null | undefined): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}
function round1(n: number): number {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

// ── Baseline / pontos vindos do banco (E4) ────────────────────────────────────
export type BaselineInput = {
  data_inicio: string | null;
  data_fim: string | null;
} | null;

export type PontoPlanejadoInput = {
  semana: number;
  data: string | null;
  planejado_pct_fisico: number | null;
  planejado_pct_financeiro: number | null;
};

export type SnapshotExecutadoInput = {
  data: string | null;
  pct_fisico: number | null;
  pct_financeiro: number | null;
};

/**
 * Curva PLANEJADA a partir dos pontos do banco (E4 aplicado). Ordena por semana, clampa, garante
 * monotonicidade não-decrescente (a curva acumulada nunca recua — corrige ruído de dado).
 */
export function planejadoDePontos(pontos: PontoPlanejadoInput[]): PontoCurva[] {
  const ordenados = [...pontos].sort((a, b) => a.semana - b.semana);
  let maxF = 0;
  let maxFin = 0;
  return ordenados.map((p) => {
    const fisico = Math.max(maxF, clampPct(p.planejado_pct_fisico));
    const financeiro = Math.max(maxFin, clampPct(p.planejado_pct_financeiro));
    maxF = fisico;
    maxFin = financeiro;
    return { semana: p.semana, data: p.data ?? null, fisico, financeiro };
  });
}

/**
 * Curva PLANEJADA LINEAR (degrade sem baseline aplicada): de 0% a 100% em N semanas entre
 * data_inicio e data_fim. Físico = financeiro no modo linear (não há perfil de desembolso ainda).
 * Sem datas válidas → curva ordinal de `semanasFallback` passos (eixo honesto, data=null).
 */
export function planejadoLinear(baseline: BaselineInput, semanasFallback = 8): PontoCurva[] {
  const ini = parseISO(baseline?.data_inicio ?? null);
  const fim = parseISO(baseline?.data_fim ?? null);

  if (ini && fim && fim.getTime() > ini.getTime()) {
    const totalDias = diffDays(fim, ini);
    const nSemanas = Math.max(1, Math.ceil(totalDias / 7));
    const pts: PontoCurva[] = [];
    for (let s = 0; s <= nSemanas; s++) {
      const dia = Math.min(totalDias, s * 7);
      const pct = round1((dia / totalDias) * 100);
      pts.push({ semana: s, data: toISO(addDays(ini, dia)), fisico: pct, financeiro: pct });
    }
    return pts;
  }

  // Sem datas: eixo ordinal 0..N (linear), data=null (a UI mostra "Semana s").
  const n = Math.max(1, semanasFallback);
  const pts: PontoCurva[] = [];
  for (let s = 0; s <= n; s++) {
    const pct = round1((s / n) * 100);
    pts.push({ semana: s, data: null, fisico: pct, financeiro: pct });
  }
  return pts;
}

/**
 * Curva EXECUTADA a partir dos snapshots append-only (E4). Mantém o ÚLTIMO snapshot por data
 * (a verdade mais recente daquele dia), ordena por data e garante monotonicidade não-decrescente.
 * Vazio → []. A UI/endpoint complementam com o ponto "ao vivo" do avanço ponderado quando precisar.
 */
export function executadoDeSnapshots(snaps: SnapshotExecutadoInput[]): PontoCurva[] {
  if (!snaps.length) return [];
  // último por data (ordem de chegada já é cronológica no append-only; aqui reforça por data).
  const porData = new Map<string, SnapshotExecutadoInput>();
  const semData: SnapshotExecutadoInput[] = [];
  for (const s of snaps) {
    if (s.data) porData.set(s.data, s); // sobrescreve = mantém o último daquele dia
    else semData.push(s);
  }
  const datasOrdenadas = [...porData.keys()].sort();
  let maxF = 0;
  let maxFin = 0;
  const pts: PontoCurva[] = [];
  datasOrdenadas.forEach((data, i) => {
    const s = porData.get(data)!;
    const fisico = Math.max(maxF, clampPct(s.pct_fisico));
    const financeiro = Math.max(maxFin, clampPct(s.pct_financeiro));
    maxF = fisico;
    maxFin = financeiro;
    pts.push({ semana: i, data, fisico, financeiro });
  });
  return pts;
}

/**
 * EXECUTADO ao vivo (degrade quando o append-only está vazio): um único ponto "hoje" com o avanço
 * ponderado dos itens. `fisico` = avancoPonderado; `financeiro` = avanço financeiro (mesmo valor no
 * modo avanço-só, ou o pct financeiro próprio quando vier). Honesto: 1 ponto, não uma curva falsa.
 */
export function executadoAoVivo(
  fisicoPonderado: number,
  financeiroPonderado: number | null,
  hojeISO: string | null
): PontoCurva[] {
  const fisico = clampPct(fisicoPonderado);
  const financeiro = financeiroPonderado == null ? fisico : clampPct(financeiroPonderado);
  return [{ semana: 0, data: hojeISO, fisico, financeiro }];
}

/**
 * % PLANEJADO para uma data específica (interpolação linear entre os 2 pontos que a cercam).
 * Antes do 1º ponto → 0; depois do último → o último. Sem datas nos pontos → null (não há como
 * cruzar com "hoje" no eixo de calendário). Devolve { fisico, financeiro } | null.
 */
export function planejadoNaData(
  planejado: PontoCurva[],
  dataISO: string | null
): { fisico: number; financeiro: number } | null {
  const hoje = parseISO(dataISO);
  if (!hoje || planejado.length === 0) return null;
  const comData = planejado.filter((p) => p.data != null);
  if (comData.length === 0) return null;

  const primeiro = parseISO(comData[0].data);
  const ultimo = parseISO(comData[comData.length - 1].data);
  if (!primeiro || !ultimo) return null;

  if (hoje.getTime() <= primeiro.getTime()) return { fisico: comData[0].fisico, financeiro: comData[0].financeiro };
  if (hoje.getTime() >= ultimo.getTime()) {
    const u = comData[comData.length - 1];
    return { fisico: u.fisico, financeiro: u.financeiro };
  }
  // acha o segmento [a,b] que contém hoje e interpola.
  for (let i = 0; i < comData.length - 1; i++) {
    const a = comData[i];
    const b = comData[i + 1];
    const da = parseISO(a.data)!;
    const db = parseISO(b.data)!;
    if (hoje.getTime() >= da.getTime() && hoje.getTime() <= db.getTime()) {
      const span = diffDays(db, da) || 1;
      const t = diffDays(hoje, da) / span;
      return {
        fisico: round1(a.fisico + (b.fisico - a.fisico) * t),
        financeiro: round1(a.financeiro + (b.financeiro - a.financeiro) * t),
      };
    }
  }
  return null;
}

/**
 * Índice do ponto "hoje" no eixo do planejado (o ponto de data mais próxima, sem ultrapassar).
 * Modo ordinal (sem datas) → o último ponto disponível (não há calendário p/ posicionar). -1 vazio.
 */
export function indiceHoje(planejado: PontoCurva[], dataISO: string | null): number {
  if (planejado.length === 0) return -1;
  const hoje = parseISO(dataISO);
  if (!hoje) return planejado.length - 1;
  let idx = -1;
  for (let i = 0; i < planejado.length; i++) {
    const d = parseISO(planejado[i].data);
    if (d && d.getTime() <= hoje.getTime()) idx = i;
  }
  return idx >= 0 ? idx : 0;
}

/**
 * KPIs honestos do cronograma. `lente` decide se o status de prazo olha físico ou financeiro
 * (a UI alterna). Previsão: projeta o ritmo médio (pct/dia) desde o início até hoje para alcançar
 * 100% — só quando há datas e avanço > 0; senão null (não inventa data).
 */
export function calcularKpis(
  planejado: PontoCurva[],
  executado: PontoCurva[],
  baseline: BaselineInput,
  hojeISO: string | null,
  lente: "fisico" | "financeiro" = "fisico"
): KpisCronograma {
  const ultimo = executado.length ? executado[executado.length - 1] : null;
  const fisicoAtual = ultimo ? clampPct(ultimo.fisico) : 0;
  const financeiroAtual = ultimo ? clampPct(ultimo.financeiro) : 0;
  const atual = lente === "financeiro" ? financeiroAtual : fisicoAtual;

  const planHoje = planejadoNaData(planejado, hojeISO);
  const planejadoHoje = planHoje ? (lente === "financeiro" ? planHoje.financeiro : planHoje.fisico) : null;

  let desvioPct: number | null = null;
  let statusPrazo: KpisCronograma["statusPrazo"] = "indefinido";
  if (planejadoHoje != null) {
    desvioPct = round1(atual - planejadoHoje);
    if (desvioPct > 2) statusPrazo = "adiantado";
    else if (desvioPct < -2) statusPrazo = "atrasado";
    else statusPrazo = "no_prazo";
  }

  // Previsão de término: ritmo = atual / dias decorridos desde o início; faltam (100-atual)/ritmo dias.
  let previsaoTermino: string | null = null;
  const ini = parseISO(baseline?.data_inicio ?? null);
  const hoje = parseISO(hojeISO);
  if (ini && hoje && fisicoAtual > 0 && fisicoAtual < 100) {
    const diasDecorridos = Math.max(1, diffDays(hoje, ini));
    const ritmo = fisicoAtual / diasDecorridos; // pct por dia
    if (ritmo > 0) {
      const diasRestantes = Math.ceil((100 - fisicoAtual) / ritmo);
      previsaoTermino = toISO(addDays(hoje, diasRestantes));
    }
  } else if (ini && hoje && fisicoAtual >= 100) {
    previsaoTermino = hojeISO;
  }

  return { fisicoAtual, financeiroAtual, planejadoHoje, desvioPct, statusPrazo, previsaoTermino };
}

/**
 * Monta a CurvaS completa (planejado + executado + hojeIndex) a partir das entradas do banco e do
 * avanço ao vivo. Decide a fonte de cada curva com o degrade honesto:
 *   - planejado: pontos do banco (se houver) → senão linear da baseline → senão ordinal.
 *   - executado: snapshots append-only (se houver) → senão 1 ponto ao vivo do avanço ponderado.
 */
export function montarCurvaS(args: {
  baseline: BaselineInput;
  pontosPlanejados: PontoPlanejadoInput[];
  snapshots: SnapshotExecutadoInput[];
  fisicoAoVivo: number;
  financeiroAoVivo: number | null;
  hojeISO: string | null;
  semanasFallback?: number;
}): CurvaS {
  const planejado =
    args.pontosPlanejados.length > 0
      ? planejadoDePontos(args.pontosPlanejados)
      : planejadoLinear(args.baseline, args.semanasFallback);

  const executado =
    args.snapshots.length > 0
      ? executadoDeSnapshots(args.snapshots)
      : executadoAoVivo(args.fisicoAoVivo, args.financeiroAoVivo, args.hojeISO);

  return { planejado, executado, hojeIndex: indiceHoje(planejado, args.hojeISO) };
}
