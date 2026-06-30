/**
 * E7c (Fase 3a) — MEDIÇÃO honesta: lógica PURA (sem I/O) do avanço derivado da quantidade.
 *
 * A medição é o registro FORMAL e auditável do avanço por ITEM (decisão #4 do dono). Esta função
 * é o espelho in-code da regra que o endpoint aplica: derivar o pct_avanco_resultante a partir da
 * quantidade FÍSICA realizada quando o item tem uma quantidade PLANEJADA — senão usa o pct informado.
 *
 * Pura → testável e usada pelo POST /api/crm/obras/[id]/medicoes (deriva o pct que grava no item-mãe).
 *
 * REGRA (honesta, sem inventar):
 *   - Se há quantidade planejada (>0) E quantidade_realizada (>=0): pct = realizada/planejada × 100,
 *     clampado a [0,100]. É a leitura física direta ("medido X de Y" vira X/Y%).
 *   - Senão (sem planejada, ou planejada 0): cai no pct informado explicitamente (slider/percentual).
 *   - Sem nenhum dos dois utilizáveis → null (o endpoint preserva o pct atual do item).
 */

export function clampPct(v: number | null | undefined): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Deriva o pct de avanço resultante de uma medição.
 *
 * @param quantidadeRealizada quantidade física medida nesta medição (>=0) ou null.
 * @param quantidadePlanejada quantidade planejada do item (hub_obra_itens.quantidade) ou null.
 * @param pctInformado        pct explícito enviado (ex.: slider/percentual) ou null.
 * @returns pct 0..100 (round2) ou null quando nada utilizável foi informado.
 */
export function derivarPctAvanco(
  quantidadeRealizada: number | null | undefined,
  quantidadePlanejada: number | null | undefined,
  pctInformado: number | null | undefined
): number | null {
  const qp = Number(quantidadePlanejada);

  // Caminho 1 (preferido): quantidade física vs. planejada → pct físico real.
  // ATENÇÃO: distinguir "ausente" (null/undefined) de "0 explícito" — Number(null) é 0, então não
  // basta Number.isFinite. Só entra no caminho físico quando a realizada FOI informada (!= null).
  if (quantidadeRealizada != null) {
    const qr = Number(quantidadeRealizada);
    if (Number.isFinite(qr) && qr >= 0 && Number.isFinite(qp) && qp > 0) {
      return clampPct(round2((qr / qp) * 100));
    }
  }

  // Caminho 2: pct informado diretamente (sem base de quantidade planejada).
  if (pctInformado != null) {
    const p = Number(pctInformado);
    if (Number.isFinite(p)) return clampPct(round2(p));
  }

  // Nada utilizável: o endpoint preserva o pct atual do item (não zera enganosamente).
  return null;
}
