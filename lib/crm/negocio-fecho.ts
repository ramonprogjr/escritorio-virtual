/**
 * Fecho de negócio — fonte ÚNICA de "esta etapa é ganho/perdido/aberto?".
 *
 * Bug que isto conserta (auditoria whole-system, A1): a ficha e os KPIs decidiam
 * "ganho" pelo slug LITERAL `etapa === "ganho"`. Mas os pipelines de MERCADO fecham
 * com slugs diferentes por mercado (`fechado_ganho`, `obra_criada`, `projeto_obra_criado`,
 * `servico_fechado`, `producao_entrega`, …) — cada um marcado por `tipo_fecho` em
 * `hub_pipeline_estagios`. Resultado do bug: venda ganha de mercado NÃO derivava status,
 * NÃO abria "gerar obra/recebível" e SUMIA dos KPIs de dinheiro.
 *
 * Regra: se o pipeline informa o `tipo_fecho` da etapa, ele MANDA; senão (negócio legado
 * sem pipeline) cai no slug conhecido.
 */
export type TipoFecho = "aberto" | "ganho" | "perdido";

export function tipoFechoDaEtapa(etapaSlug: string, tipoFechoPipeline?: string | null): TipoFecho {
  const tf = (tipoFechoPipeline ?? "").trim().toLowerCase();
  if (tf === "ganho" || tf === "perdido" || tf === "aberto") return tf;
  const s = (etapaSlug ?? "").trim().toLowerCase();
  if (s === "ganho" || s === "fechado_ganho") return "ganho";
  if (s === "perdido" || s === "fechado_perdido") return "perdido";
  return "aberto";
}

/** Status canônico derivado do fecho, quando o caller NÃO envia status explícito. */
export function statusDoFecho(tipoFecho: TipoFecho): "fechado_ganho" | "fechado_perdido" | null {
  if (tipoFecho === "ganho") return "fechado_ganho";
  if (tipoFecho === "perdido") return "fechado_perdido";
  return null; // aberto → não força status
}

/** Evento de KPI (hub_eventos) correspondente ao fecho. */
export function eventTypeDoFecho(
  tipoFecho: TipoFecho
): "negocio_ganho" | "negocio_perdido" | "negocio_etapa_mudou" {
  if (tipoFecho === "ganho") return "negocio_ganho";
  if (tipoFecho === "perdido") return "negocio_perdido";
  return "negocio_etapa_mudou";
}
