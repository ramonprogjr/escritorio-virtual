/**
 * E3 — Restrições/Bloqueios de 1ª classe: lógica PURA (sem I/O).
 *
 * O insight da planilha do dono (§13 da spec) em código: o BOOLEAN `falta_*` em E2 é a
 * fonte de verdade do "tem bloqueio AGORA?". E3 NÃO duplica esse boolean — ele PROMOVE
 * o boolean a um DOSSIÊ de resolução (quem/prazo/impacto/histórico/ação/elo SC).
 *
 *   - tipo (5+1) ↔ 1:1 com os 5 booleans de E2 (cols J–N) + 'outro';
 *   - status = ciclo de vida (aberta/em_resolucao/resolvida/reaberta/virou_pendencia);
 *   - impacto categórico (trava/atrasa/observa) = selo visual, ordena o cockpit;
 *   - SST (documento) = readonly-resolver (§19): regularização auditada, nunca 1-toque.
 *
 * Espelho in-code da migração 20260712120000_e3_obra_restricoes.sql (CHECKs e mapeamentos).
 * Serve de fonte única para endpoints, tools de IA e UI — zero hex/enum inventado.
 */

import { BLOQUEIOS, type BloqueioCampo } from "@/lib/obras/itens-situacao";

// ── Enums (espelham os CHECK da tabela) ──────────────────────────────────────
/** tipo 1:1 com os 5 booleans `falta_*` de E2 + escape 'outro'. */
export const TIPOS_RESTRICAO = [
  "material",
  "pessoa",
  "documento",
  "ferramenta",
  "equipamento",
  "outro",
] as const;
export type TipoRestricao = (typeof TIPOS_RESTRICAO)[number];

/** Ciclo de vida da restrição. 'virou_pendencia' = reclassificada (§13: decisão, não falta). */
export const STATUS_RESTRICAO = [
  "aberta",
  "em_resolucao",
  "resolvida",
  "reaberta",
  "virou_pendencia",
] as const;
export type StatusRestricao = (typeof STATUS_RESTRICAO)[number];

/** Status que contam como "ativa" (travam a obra agora / aparecem no cockpit). */
export const STATUS_ABERTOS: readonly StatusRestricao[] = ["aberta", "em_resolucao", "reaberta"];

/** Impacto categórico (selo visual + ordenação). impacto_dias é a estimativa numérica. */
export const IMPACTOS_RESTRICAO = ["trava", "atrasa", "observa"] as const;
export type ImpactoRestricao = (typeof IMPACTOS_RESTRICAO)[number];

/** Ações sugeridas tipadas (Click-and-Go: o caminho já vem pronto). */
export const ACOES_SUGERIDAS = [
  "gerar_pedido", // material → rascunho SC (E5)
  "atribuir_responsavel", // pessoa → cobrar/atribuir
  "solicitar_documento", // documento → anexar/regularizar
  "providenciar", // ferramenta/equipamento → genérico
  "registrar", // outro
] as const;
export type AcaoSugerida = (typeof ACOES_SUGERIDAS)[number];

// ── Mapeamento tipo ↔ boolean E2 (a regra de não-duplicação) ──────────────────
/** tipo de restrição → coluna boolean de E2 (null para 'outro', que não tem boolean). */
const TIPO_PARA_BOOLEAN: Record<TipoRestricao, BloqueioCampo | null> = {
  material: "falta_material",
  pessoa: "falta_pessoa",
  documento: "falta_documento",
  ferramenta: "falta_ferramenta",
  equipamento: "falta_equipamento",
  outro: null,
};

/** boolean de E2 → tipo de restrição (a direção da PROMOÇÃO). */
const BOOLEAN_PARA_TIPO: Record<BloqueioCampo, TipoRestricao> = {
  falta_material: "material",
  falta_pessoa: "pessoa",
  falta_documento: "documento",
  falta_ferramenta: "ferramenta",
  falta_equipamento: "equipamento",
};

/** Coluna boolean de E2 correspondente ao tipo (null se 'outro'). */
export function booleanDoTipo(tipo: TipoRestricao): BloqueioCampo | null {
  return TIPO_PARA_BOOLEAN[tipo] ?? null;
}

/** Tipo de restrição a partir do boolean de E2 ligado. */
export function tipoDoBooleano(campo: BloqueioCampo): TipoRestricao {
  return BOOLEAN_PARA_TIPO[campo];
}

// ── Apresentação (ícone, rótulo, cor) — fiel ao seed E2 + paleta da marca ──────
/** Ícone + rótulo por tipo (reusa os mesmos ícones de E2 para coerência visual). */
export const APRESENTACAO_TIPO: Record<TipoRestricao, { icone: string; label: string }> = {
  material: { icone: "📦", label: "Material" },
  pessoa: { icone: "👤", label: "Pessoa" },
  documento: { icone: "📄", label: "Documento" },
  ferramenta: { icone: "🔧", label: "Ferramenta" },
  equipamento: { icone: "🚜", label: "Equipamento" },
  outro: { icone: "⛔", label: "Outro" },
};

/** Cor + rótulo do impacto (trava=vermelho sólido, atrasa=âmbar, observa=cinza). */
export const APRESENTACAO_IMPACTO: Record<ImpactoRestricao, { cor: string; label: string }> = {
  trava: { cor: "#EF4444", label: "Trava" },
  atrasa: { cor: "#F59E0B", label: "Atrasa" },
  observa: { cor: "#8b949e", label: "Observa" },
};

// ── Default da ação sugerida por tipo (Click-and-Go) ──────────────────────────
const ACAO_PADRAO_POR_TIPO: Record<TipoRestricao, AcaoSugerida> = {
  material: "gerar_pedido",
  pessoa: "atribuir_responsavel",
  documento: "solicitar_documento",
  ferramenta: "providenciar",
  equipamento: "providenciar",
  outro: "registrar",
};

/** Sugere a ação tipada a partir do tipo da restrição. */
export function acaoSugeridaPadrao(tipo: TipoRestricao): AcaoSugerida {
  return ACAO_PADRAO_POR_TIPO[tipo] ?? "registrar";
}

// ── SST: documento com poder de bloqueio (§19, Emenda 2) ──────────────────────
/**
 * Uma restrição de DOCUMENTO marcada como SST (origem='sst' ou flag sst) é
 * readonly-resolver: NÃO pode ser resolvida por voz nem em 1 toque — só por
 * regularização auditada. O botão [Resolver] fica desabilitado com tooltip.
 */
export function ehSstReadonly(r: {
  tipo: TipoRestricao | string | null;
  origem?: string | null;
  sst?: boolean | null;
}): boolean {
  if (String(r.tipo) !== "documento") return false;
  return r.sst === true || String(r.origem ?? "") === "sst";
}

// ── Ordenação para o cockpit (trava > atrasa > observa; depois +dias) ──────────
const PESO_IMPACTO: Record<ImpactoRestricao, number> = { trava: 0, atrasa: 1, observa: 2 };

export type RestricaoOrdenavel = {
  impacto: ImpactoRestricao | string | null;
  impacto_dias: number | null;
};

/**
 * Comparador para o painel "Hoje": mais grave primeiro (trava), depois mais dias de
 * impacto. Empate estável (retorna 0) — o caller pode encadear desempate por data.
 */
export function compararRestricoes(a: RestricaoOrdenavel, b: RestricaoOrdenavel): number {
  const pa = PESO_IMPACTO[(a.impacto as ImpactoRestricao) ?? "observa"] ?? 2;
  const pb = PESO_IMPACTO[(b.impacto as ImpactoRestricao) ?? "observa"] ?? 2;
  if (pa !== pb) return pa - pb;
  const da = Number.isFinite(Number(a.impacto_dias)) ? Number(a.impacto_dias) : 0;
  const db = Number.isFinite(Number(b.impacto_dias)) ? Number(b.impacto_dias) : 0;
  return db - da; // mais dias de impacto primeiro
}

// ── Guards de tipo ────────────────────────────────────────────────────────────
export function isTipoRestricao(v: string): v is TipoRestricao {
  return (TIPOS_RESTRICAO as readonly string[]).includes(v);
}
export function isStatusRestricao(v: string): v is StatusRestricao {
  return (STATUS_RESTRICAO as readonly string[]).includes(v);
}
export function isImpactoRestricao(v: string): v is ImpactoRestricao {
  return (IMPACTOS_RESTRICAO as readonly string[]).includes(v);
}
export function isAcaoSugerida(v: string): v is AcaoSugerida {
  return (ACOES_SUGERIDAS as readonly string[]).includes(v);
}

/** Status considerado "ativo" (não resolvido nem virou pendência). */
export function ehRestricaoAtiva(status: StatusRestricao | string | null): boolean {
  return (STATUS_ABERTOS as readonly string[]).includes(String(status));
}

// ── Linha persistida da view/tabela (o shape que a API devolve) ───────────────
/** Origem unificada da view: dossiê E3 ou boolean E2 ainda sem dossiê. */
export type FonteBloqueio = "e3" | "e2_boolean";

export type RestricaoRow = {
  id: string;
  obra_id: string;
  tenant_id?: string;
  item_id: string | null;
  frente_id: string | null;
  tipo: TipoRestricao;
  status: StatusRestricao;
  titulo: string | null;
  descricao: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  prazo_resolucao: string | null;
  impacto: ImpactoRestricao | null;
  impacto_dias: number | null;
  impacto_frente_id: string | null;
  acao_sugerida: AcaoSugerida | null;
  pedido_material_id: string | null;
  pendencia_id: string | null;
  sst?: boolean | null;
  origem: string | null;
  resolvido_em: string | null;
  resolvido_por: string | null;
  criado_em?: string | null;
};

/** Linha da view unificada de bloqueios do dia (E3 abertas + booleans E2 órfãos). */
export type BloqueioHojeRow = {
  fonte: FonteBloqueio;
  restricao_id: string | null; // null quando fonte='e2_boolean' (boolean sem dossiê)
  obra_id: string;
  obra_titulo: string | null;
  item_id: string | null;
  frente_id: string | null;
  tipo: TipoRestricao;
  status: StatusRestricao | null;
  titulo: string | null;
  responsavel_nome: string | null;
  prazo_resolucao: string | null;
  impacto: ImpactoRestricao | null;
  impacto_dias: number | null;
  acao_sugerida: AcaoSugerida | null;
  origem: string | null;
};

/** Conjunto dos 5 campos boolean de E2 (reexport tipado para os consumidores de E3). */
export const CAMPOS_BLOQUEIO_E2 = BLOQUEIOS.map((b) => b.campo) as readonly BloqueioCampo[];
