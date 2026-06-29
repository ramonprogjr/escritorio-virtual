/**
 * E5 — Compras → Estoque (SC · Movimentação · Inventário): lógica PURA (sem I/O).
 *
 * Transpõe as 3 abas vivas da planilha do Consulado para regra única, fonte de verdade para
 * endpoints, tools de IA e UI (zero enum/hex inventado). Decisões verificadas em docs/E5-DESIGN.md:
 *   - SC = cabeçalho (hub_pedidos_material) + itens (hub_pedido_itens); Tipo→Descrição filtra o catálogo;
 *   - Movimentação = hub_estoque_mov APPEND-ONLY (entrada/saida/devolucao/ajuste; quantidade>0, sinal do tipo);
 *   - Inventário = VIEW derivada (Entrada − Saída + Devolução + Ajuste); estoque negativo é PERMITIDO (alerta);
 *   - Cotações v1 = cotacoes_json no item; a IA SUGERE a melhor (preço/prazo/risco), o HUMANO escolhe e aprova.
 *
 * Espelho in-code da migração 20260720120000_e5_compras_estoque.sql (CHECKs e mapeamentos).
 */

// ── Enums (espelham os CHECK da tabela) ──────────────────────────────────────

/** Tipo de material da SC ↔ categorias do hub_catalogo que entram na SC (filtra a Descrição). */
export const TIPOS_MATERIAL_SC = ["material", "equipamento", "servico", "mao_de_obra"] as const;
export type TipoMaterialSc = (typeof TIPOS_MATERIAL_SC)[number];

/** Ciclo de vida da SC (status de hub_pedidos_material, ampliado com entregue_parcial). */
export const STATUS_SC = [
  "rascunho",
  "cotando",
  "aprovado",
  "entregue_parcial",
  "entregue",
  "cancelado",
] as const;
export type StatusSc = (typeof STATUS_SC)[number];

/** Status "em aberto" (proxy de bloqueio no cockpit E1; ainda não fechados). */
export const STATUS_SC_ABERTOS: readonly StatusSc[] = [
  "rascunho",
  "cotando",
  "aprovado",
  "entregue_parcial",
];

/** Urgência (selo visual + ordenação). */
export const URGENCIAS_SC = ["normal", "urgente", "critico"] as const;
export type UrgenciaSc = (typeof URGENCIAS_SC)[number];

/** Origem da SC (manual, IA sugeriu, ou veio do elo E3 "falta material"). */
export const ORIGENS_SC = ["manual", "ia", "e3_restricao"] as const;
export type OrigemSc = (typeof ORIGENS_SC)[number];

/** Tipo de movimentação de estoque. */
export const TIPOS_MOVIMENTO = ["entrada", "saida", "devolucao", "ajuste"] as const;
export type TipoMovimento = (typeof TIPOS_MOVIMENTO)[number];

// ── Apresentação (ícone, rótulo, cor) — paleta da marca verde+dourado dark ─────

export const APRESENTACAO_TIPO_MATERIAL: Record<TipoMaterialSc, { icone: string; label: string }> = {
  material: { icone: "📦", label: "Material" },
  equipamento: { icone: "🚜", label: "Equipamento" },
  servico: { icone: "🛠️", label: "Serviço" },
  mao_de_obra: { icone: "👷", label: "Mão de obra" },
};

export const APRESENTACAO_URGENCIA: Record<UrgenciaSc, { cor: string; label: string }> = {
  normal: { cor: "#8b949e", label: "Normal" },
  urgente: { cor: "#F59E0B", label: "Urgente" },
  critico: { cor: "#EF4444", label: "Crítico" },
};

export const APRESENTACAO_STATUS_SC: Record<StatusSc, { cor: string; label: string }> = {
  rascunho: { cor: "#8b949e", label: "Rascunho" },
  cotando: { cor: "#3B82F6", label: "Em cotação" },
  aprovado: { cor: "#c9a24a", label: "Aprovada" },
  entregue_parcial: { cor: "#F59E0B", label: "Entrega parcial" },
  entregue: { cor: "#3fb950", label: "Entregue" },
  cancelado: { cor: "#6e7681", label: "Cancelada" },
};

export const APRESENTACAO_MOVIMENTO: Record<TipoMovimento, { icone: string; label: string; cor: string }> = {
  entrada: { icone: "⬇", label: "Entrada", cor: "#3fb950" },
  saida: { icone: "⬆", label: "Saída", cor: "#F59E0B" },
  devolucao: { icone: "↩", label: "Devolução", cor: "#3B82F6" },
  ajuste: { icone: "⚖", label: "Ajuste", cor: "#8b949e" },
};

// ── Guards de tipo ─────────────────────────────────────────────────────────────
export function isTipoMaterialSc(v: string): v is TipoMaterialSc {
  return (TIPOS_MATERIAL_SC as readonly string[]).includes(v);
}
export function isStatusSc(v: string): v is StatusSc {
  return (STATUS_SC as readonly string[]).includes(v);
}
export function isUrgenciaSc(v: string): v is UrgenciaSc {
  return (URGENCIAS_SC as readonly string[]).includes(v);
}
export function isOrigemSc(v: string): v is OrigemSc {
  return (ORIGENS_SC as readonly string[]).includes(v);
}
export function isTipoMovimento(v: string): v is TipoMovimento {
  return (TIPOS_MOVIMENTO as readonly string[]).includes(v);
}

// ── Cotações v1 (cotacoes_json no item) ─────────────────────────────────────────

/** Uma cotação dentro de cotacoes_json. fornecedor_id ausente = fornecedor não cadastrado (risco). */
export type CotacaoItem = {
  fornecedor_nome: string;
  fornecedor_id?: string | null;
  valor_total: number;
  prazo_dias?: number | null;
  homologado?: boolean | null;
  /** Preenchido pela IA (determinístico aqui); null quando sem dados. */
  score_ia?: { total: number; preco: number; prazo: number; risco: number } | null;
  escolhida?: boolean;
};

/** Pesos do score IA de cotação (preço/prazo/risco). DEFAULT arbitrário — o dono calibra (memória). */
export const PESOS_SCORE_COTACAO = { preco: 0.5, prazo: 0.3, risco: 0.2 } as const;

/**
 * Score determinístico de custo-benefício de cotações (0..1, maior = melhor). Normaliza preço e
 * prazo entre as cotações; risco penaliza fornecedor não cadastrado (sem fornecedor_id). NÃO chama
 * LLM — é a base factual; a justificativa textual da IA (MISTRAL) é opcional por cima.
 * Cotações sem base comparável (1 só, ou valores inválidos) recebem score_ia=null ("sem dados").
 */
export function pontuarCotacoes(cotacoes: CotacaoItem[]): CotacaoItem[] {
  const validas = cotacoes.filter((c) => Number.isFinite(c.valor_total) && c.valor_total > 0);
  if (validas.length < 2) {
    // sem base de comparação → não inventa score
    return cotacoes.map((c) => ({ ...c, score_ia: null }));
  }

  const precos = validas.map((c) => c.valor_total);
  const minPreco = Math.min(...precos);
  const maxPreco = Math.max(...precos);
  const prazos = validas
    .map((c) => (Number.isFinite(Number(c.prazo_dias)) ? Number(c.prazo_dias) : null))
    .filter((p): p is number => p != null);
  const minPrazo = prazos.length ? Math.min(...prazos) : 0;
  const maxPrazo = prazos.length ? Math.max(...prazos) : 0;

  const norm = (v: number, lo: number, hi: number): number => {
    if (hi <= lo) return 1; // todos iguais → componente neutro alto
    return (hi - v) / (hi - lo); // menor preço/prazo = score maior
  };

  return cotacoes.map((c) => {
    if (!Number.isFinite(c.valor_total) || c.valor_total <= 0) {
      return { ...c, score_ia: null };
    }
    const sPreco = norm(c.valor_total, minPreco, maxPreco);
    const prazo = Number.isFinite(Number(c.prazo_dias)) ? Number(c.prazo_dias) : maxPrazo;
    const sPrazo = prazos.length ? norm(prazo, minPrazo, maxPrazo) : 0.5;
    // risco: fornecedor cadastrado/homologado pontua; avulso (sem id) penaliza.
    const sRisco = c.fornecedor_id ? (c.homologado ? 1 : 0.7) : 0.2;
    const total =
      sPreco * PESOS_SCORE_COTACAO.preco +
      sPrazo * PESOS_SCORE_COTACAO.prazo +
      sRisco * PESOS_SCORE_COTACAO.risco;
    return {
      ...c,
      score_ia: {
        total: Math.round(total * 1000) / 1000,
        preco: Math.round(sPreco * 1000) / 1000,
        prazo: Math.round(sPrazo * 1000) / 1000,
        risco: Math.round(sRisco * 1000) / 1000,
      },
    };
  });
}

/** Índice (na lista original) da melhor cotação por score; -1 se nenhuma pontuável. */
export function melhorCotacaoIndice(cotacoes: CotacaoItem[]): number {
  let melhor = -1;
  let melhorScore = -Infinity;
  cotacoes.forEach((c, i) => {
    const s = c.score_ia?.total;
    if (typeof s === "number" && s > melhorScore) {
      melhorScore = s;
      melhor = i;
    }
  });
  return melhor;
}

/** Sanitiza o cotacoes_json vindo do body/IA — descarta lixo, normaliza tipos. */
export function sanitizarCotacoes(raw: unknown): CotacaoItem[] {
  if (!Array.isArray(raw)) return [];
  const out: CotacaoItem[] = [];
  for (const item of raw.slice(0, 20)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const nome = typeof o.fornecedor_nome === "string" ? o.fornecedor_nome.trim() : "";
    const valor = Number(o.valor_total);
    if (!nome || !Number.isFinite(valor)) continue;
    const cot: CotacaoItem = {
      fornecedor_nome: nome.slice(0, 160),
      valor_total: valor,
    };
    if (typeof o.fornecedor_id === "string" && o.fornecedor_id.trim()) {
      cot.fornecedor_id = o.fornecedor_id.trim();
    }
    if (Number.isFinite(Number(o.prazo_dias))) cot.prazo_dias = Math.max(0, Math.round(Number(o.prazo_dias)));
    if (typeof o.homologado === "boolean") cot.homologado = o.homologado;
    if (o.escolhida === true) cot.escolhida = true;
    out.push(cot);
  }
  return out;
}

// ── Inventário derivado (espelho da VIEW) ───────────────────────────────────────

/** Linha do inventário (shape da vw_hub_inventario). em_estoque pode ser NEGATIVO (alerta na UI). */
export type InventarioRow = {
  obra_id: string;
  tenant_id?: string;
  catalogo_id: string | null;
  descricao: string | null;
  categoria: string | null;
  unidade: string | null;
  codigo_catalogo: string | null;
  em_estoque: number;
  total_entrada: number;
  total_saida: number;
  total_devolucao: number;
  total_ajuste: number;
  num_movimentos: number;
  ultima_mov_em: string | null;
};

/**
 * A fórmula visível "Entr.50 − Saí.14 + Dev.2" (T3 do design): confiança via transparência.
 * Inclui ajuste só quando houver, para não poluir o caso comum.
 */
export function formulaInventario(r: {
  total_entrada?: number | null;
  total_saida?: number | null;
  total_devolucao?: number | null;
  total_ajuste?: number | null;
}): string {
  const ent = Number(r.total_entrada ?? 0);
  const sai = Number(r.total_saida ?? 0);
  const dev = Number(r.total_devolucao ?? 0);
  const aj = Number(r.total_ajuste ?? 0);
  const partes = [`Entr.${num(ent)}`, `− Saí.${num(sai)}`, `+ Dev.${num(dev)}`];
  if (aj) partes.push(`${aj >= 0 ? "+" : "−"} Aj.${num(Math.abs(aj))}`);
  return partes.join(" ");
}

/** Preview do efeito de uma movimentação (T4 do design: "Após: ficará 26 saco"). */
export function previewAposMovimento(
  estoqueAtual: number,
  tipo: TipoMovimento,
  quantidade: number
): number {
  const q = Number.isFinite(quantidade) ? quantidade : 0;
  switch (tipo) {
    case "entrada":
    case "devolucao":
    case "ajuste":
      return estoqueAtual + q;
    case "saida":
      return estoqueAtual - q;
    default:
      return estoqueAtual;
  }
}

/** Formata número curto (sem casas decimais inúteis: 50 não vira 50.000). */
function num(v: number): string {
  if (!Number.isFinite(v)) return "0";
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000);
}
