/**
 * E2 — Item × Subitem: lógica PURA de Situação (auto) × Andamento (manual). Sem I/O.
 *
 * O insight da planilha do dono em código: a MÁQUINA calcula a "Situação" pelo prazo,
 * o HUMANO declara o "Andamento". Os dois NUNCA colidem — são canais distintos.
 *   - Situação  = derivada (a_iniciar/em_andamento/atencao/atrasado/concluido/sem_data/cancelado).
 *   - Andamento = manual    (nao_iniciado/iniciado/paralisado/finalizado/cancelado).
 *
 * KPI "Finalizados" conta SEMPRE andamento==='finalizado' — NUNCA a situação nem pct>=100.
 * (regra travada em teste; ver itens-situacao.test.ts)
 *
 * Espelho in-code da migração 20260710120000_e2_obra_itens.sql:
 *   - mesma CASE da view vw_hub_obra_itens_situacao (fonte canônica em runtime é a view);
 *   - serve de fallback quando a migração E2 ainda não foi aplicada (a UI calcula localmente
 *     a partir dos campos crus, em vez de quebrar);
 *   - cores fiéis ao seed E0 (paleta verde+dourado dark da marca, zero hex inventado).
 */

// ── Enums (espelham os CHECK da tabela) ──────────────────────────────────────
export const SITUACOES = [
  "a_iniciar",
  "em_andamento",
  "atencao",
  "atrasado",
  "concluido",
  "sem_data",
  "cancelado",
] as const;
export type SituacaoItem = (typeof SITUACOES)[number];

export const ANDAMENTOS = [
  "nao_iniciado",
  "iniciado",
  "paralisado",
  "finalizado",
  "cancelado",
] as const;
export type AndamentoItem = (typeof ANDAMENTOS)[number];

export const TIPOS_ITEM = ["contrato", "aditivo", "servico_extra"] as const;
export type TipoItem = (typeof TIPOS_ITEM)[number];

/** Os 5 bloqueios da planilha (cols J–N), na ordem em que aparecem na ficha. */
export const BLOQUEIOS = [
  { campo: "falta_pessoa", label: "Pessoa", icone: "👤" },
  { campo: "falta_documento", label: "Documento", icone: "📄" },
  { campo: "falta_material", label: "Material", icone: "📦" },
  { campo: "falta_ferramenta", label: "Ferramenta", icone: "🔧" },
  { campo: "falta_equipamento", label: "Equipamento", icone: "🚜" },
] as const;
export type BloqueioCampo = (typeof BLOQUEIOS)[number]["campo"];

// ── Cores + rótulos (SITUAÇÃO = canal COR; fiel ao seed E0) ───────────────────
export const COR_SITUACAO: Record<SituacaoItem, string> = {
  a_iniciar: "#6B7280", // cinza — ainda não começou
  em_andamento: "#C9A24A", // dourado — em curso, no prazo (cor-âncora da marca)
  atencao: "#F59E0B", // âmbar — vence em ≤3d e <70%
  atrasado: "#EF4444", // vermelho — vencido e <100%
  concluido: "#22C55E", // verde — fechado
  sem_data: "#484f58", // cinza-escuro — sem prazo definido (tolerado)
  cancelado: "#6E7781", // cinza riscado
};

export const ROTULO_SITUACAO: Record<SituacaoItem, string> = {
  a_iniciar: "A iniciar",
  em_andamento: "Em andamento",
  atencao: "Atenção",
  atrasado: "Atrasado",
  concluido: "Concluído",
  sem_data: "Sem data",
  cancelado: "Cancelado",
};

// ── Cores + rótulos (ANDAMENTO = canal FORMA+TEXTO; chip clicável) ────────────
export const COR_ANDAMENTO: Record<AndamentoItem, string> = {
  nao_iniciado: "#8b949e", // cinza
  iniciado: "#3B82F6", // azul
  paralisado: "#F97316", // laranja
  finalizado: "#22C55E", // verde
  cancelado: "#6E7781", // cinza riscado
};

export const ROTULO_ANDAMENTO: Record<AndamentoItem, string> = {
  nao_iniciado: "Não iniciado",
  iniciado: "Iniciado",
  paralisado: "Paralisado",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

// ── Item cru (subconjunto das colunas usadas pela derivação) ──────────────────
export type ItemSituacaoInput = {
  andamento: AndamentoItem | string | null;
  pct_avanco: number | null;
  situacao_override: SituacaoItem | string | null;
  data_inicio: string | null; // YYYY-MM-DD ou ISO
  data_termino: string | null;
};

/** Normaliza data para YYYY-MM-DD (aceita ISO com hora). null se inválida. */
function soData(v: string | null | undefined): string | null {
  if (!v || typeof v !== "string") return null;
  const m = v.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/** Hoje local em YYYY-MM-DD (mesma base do cockpit E1). */
export function hojeISODate(agora: Date = new Date()): string {
  const y = agora.getFullYear();
  const m = String(agora.getMonth() + 1).padStart(2, "0");
  const d = String(agora.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Dias entre datas YYYY-MM-DD (b - a). Positivo = b no futuro. */
export function diasEntre(aISO: string, bISO: string): number {
  const a = Date.parse(`${aISO}T00:00:00Z`);
  const b = Date.parse(`${bISO}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/**
 * Situação AUTOMÁTICA — espelho EXATO da CASE da view vw_hub_obra_itens_situacao.
 * Usada como fallback quando a migração E2 não foi aplicada (a view não existe ainda),
 * ou para recálculo otimista na UI após editar avanço/datas sem ir ao servidor.
 *
 * A ordem das cláusulas é sagrada (espelha o SQL): cancelado → concluído (andamento OU
 * pct≥100) → override → sem_data → atrasado → a_iniciar → atenção → em_andamento.
 */
export function derivarSituacao(
  i: ItemSituacaoInput,
  hojeISO: string = hojeISODate()
): SituacaoItem {
  const pct = Number.isFinite(Number(i.pct_avanco)) ? Number(i.pct_avanco) : 0;
  const and = String(i.andamento ?? "");

  if (and === "cancelado") return "cancelado";
  if (and === "finalizado" || pct >= 100) return "concluido"; // andamento manda no fecho
  if (i.situacao_override && (SITUACOES as readonly string[]).includes(i.situacao_override)) {
    return i.situacao_override as SituacaoItem;
  }
  const ini = soData(i.data_inicio);
  const fim = soData(i.data_termino);
  if (!fim || !ini) return "sem_data";
  if (diasEntre(hojeISO, fim) < 0 && pct < 100) return "atrasado";
  if (diasEntre(hojeISO, ini) > 0) return "a_iniciar";
  const ate = diasEntre(hojeISO, fim);
  if (ate >= 0 && ate <= 3 && pct < 70) return "atencao";
  return "em_andamento";
}

/** Dias de atraso (positivo = vencido há N dias); null se sem término. */
export function diasAtraso(
  dataTermino: string | null,
  hojeISO: string = hojeISODate()
): number | null {
  const fim = soData(dataTermino);
  if (!fim) return null;
  return diasEntre(fim, hojeISO);
}

// ── Avanço derivado (item com subitens = média; folha = valor próprio) ─────────
type ComAvanço = { pct_avanco: number | null; andamento: AndamentoItem | string | null };

/**
 * Avanço de um item com subitens = média dos subitens ATIVOS não-cancelados (honesto, sem
 * fingir ponderação por peso — `peso` existe mas só trava em E4). Se não houver subitens
 * elegíveis, devolve null (o caller usa o pct_avanco próprio do item — folha).
 */
export function avancoDerivadoDeSubitens(subitens: ComAvanço[]): number | null {
  const elegiveis = subitens.filter((s) => String(s.andamento ?? "") !== "cancelado");
  if (!elegiveis.length) return null;
  const soma = elegiveis.reduce((acc, s) => {
    const n = Number(s.pct_avanco);
    return acc + (Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0);
  }, 0);
  return Math.round(soma / elegiveis.length);
}

// ── KPIs da obra (a régua da planilha) ───────────────────────────────────────
export type ItemKpiInput = {
  andamento: AndamentoItem | string | null;
  situacao: SituacaoItem | string | null;
  parent_id?: string | null;
};

/**
 * KPIs fiéis à planilha. REGRA TRAVADA:
 *   - finalizados = COUNT(andamento==='finalizado')  ← NUNCA situação, NUNCA pct>=100;
 *   - cancelados saem do numerador E do denominador (default; a planilha separa "Cancelado");
 *   - só conta os ITENS de nível-0 (parent_id null) para não dobrar com subitens.
 */
export function calcularKpisItens(itens: ItemKpiInput[]): {
  total: number;
  finalizados: number;
  atrasados: number;
  bloqueados: number; // contado fora (situação não traz bloqueio); mantido p/ assinatura estável
  cancelados: number;
  emAndamento: number;
} {
  const nivel0 = itens.filter((i) => i.parent_id == null);
  const cancelados = nivel0.filter((i) => String(i.andamento ?? "") === "cancelado").length;
  const consideraveis = nivel0.filter((i) => String(i.andamento ?? "") !== "cancelado");
  const finalizados = consideraveis.filter(
    (i) => String(i.andamento ?? "") === "finalizado"
  ).length;
  const atrasados = consideraveis.filter((i) => String(i.situacao ?? "") === "atrasado").length;
  const emAndamento = consideraveis.filter(
    (i) => String(i.situacao ?? "") === "em_andamento"
  ).length;
  return {
    total: consideraveis.length,
    finalizados,
    atrasados,
    bloqueados: 0,
    cancelados,
    emAndamento,
  };
}

/** Conta quantos bloqueios (faltas) um item tem ligados. */
export function contarBloqueios(i: Record<string, unknown>): number {
  return BLOQUEIOS.reduce((n, b) => (i[b.campo] === true ? n + 1 : n), 0);
}

// ── Guards de tipo ────────────────────────────────────────────────────────────
export function isSituacaoItem(v: string): v is SituacaoItem {
  return (SITUACOES as readonly string[]).includes(v);
}
export function isAndamentoItem(v: string): v is AndamentoItem {
  return (ANDAMENTOS as readonly string[]).includes(v);
}
export function isTipoItem(v: string): v is TipoItem {
  return (TIPOS_ITEM as readonly string[]).includes(v);
}

/** Gera um código técnico a partir do nome (Click-and-Go: não digita slug). */
export function codigoItemFromNome(nome: string, prefixo?: string): string {
  const base = (nome || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 10);
  const p = (prefixo || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  if (p) return `${p}.${base || "01"}`;
  return base || `IT${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

/** Linha persistida da view (o que a API devolve). */
export type ItemObraRow = {
  id: string;
  obra_id: string;
  frente_id: string | null;
  parent_id: string | null;
  codigo: string;
  nome: string;
  descricao: string | null;
  disciplina_slug: string | null;
  area_codigo: string | null;
  area_label: string | null;
  tipo: TipoItem;
  data_inicio: string | null;
  data_termino: string | null;
  pct_avanco: number;
  situacao_override: SituacaoItem | null;
  andamento: AndamentoItem;
  falta_pessoa: boolean;
  falta_documento: boolean;
  falta_material: boolean;
  falta_ferramenta: boolean;
  falta_equipamento: boolean;
  bloqueio_obs: string | null;
  quantidade: number | null;
  unidade: string | null;
  valor_contrato: number | null;
  responsavel_nome: string | null;
  tem_evidencia: boolean;
  evidencia_url: string | null;
  observacoes: string | null;
  peso: number;
  ordem: number;
  ativo: boolean;
  origem: "manual" | "ia" | "importacao" | "aditivo";
  // derivados da view (presentes quando lido de vw_hub_obra_itens_situacao):
  situacao?: SituacaoItem;
  dias_atraso?: number | null;
};
