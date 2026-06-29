/**
 * E6 — Financeiro de obra (Orçamento · Aprovação dupla · Pagamento · ESCROW · Compatibilização):
 * lógica PURA (sem I/O). Fonte única de verdade para endpoints, tools de IA e UI — zero enum/hex
 * inventado. Decisões verificadas em docs/E6-DESIGN.md + docs/insumos-do-dono/modelos-contrato-e-escrow.md:
 *
 *   - tipo_contrato é atributo IMUTÁVEL da obra: 'administracao' (cliente vê UNITÁRIO, livro aberto)
 *     × 'preco_fechado' (turn-key, só TOTAIS). A bifurcação é na APRESENTAÇÃO, não no schema.
 *   - Orçamento por frente (Gate 1) → aprovado libera os pagamentos da frente.
 *   - Pagamento (Gate 2 DUPLO): aprovação da ARQUITETURA + aprovação do HUB. O escrow só libera
 *     com as DUAS chaves. A IA prepara, NUNCA aprova (humano aprova o dinheiro).
 *   - ESCROW = custódia contábil (MVP, provedor='interno'); movimentos APPEND-ONLY (extrato imutável).
 *   - Compatibilização (cobertura): 🟢 coberto · 🟡 parcial/pendente · 🔴 sem orçamento, com %.
 *   - 'atrasado' do pagamento é DERIVADO (status liberável + vencimento<hoje), nunca coluna.
 *
 * Espelho in-code da migração 20260730120000_e6_financeiro_contrato_escrow.sql (CHECKs e mapeamentos).
 */

// ── tipo_contrato (atributo IMUTÁVEL da obra) ────────────────────────────────
export const TIPOS_CONTRATO = ["administracao", "preco_fechado"] as const;
export type TipoContrato = (typeof TIPOS_CONTRATO)[number];

export function isTipoContrato(v: string): v is TipoContrato {
  return (TIPOS_CONTRATO as readonly string[]).includes(v);
}

export const APRESENTACAO_TIPO_CONTRATO: Record<
  TipoContrato,
  { label: string; sublabel: string; icone: string }
> = {
  administracao: { label: "Administração", sublabel: "livro aberto", icone: "📖" },
  preco_fechado: { label: "Preço fechado", sublabel: "turn-key", icone: "📦" },
};

/** Cliente vê valor unitário só na administração (gestão aberta). Preço fechado = só totais. */
export function mostraUnitario(tipo: TipoContrato): boolean {
  return tipo === "administracao";
}

/** Rótulos do segmented control mudam por tipo de contrato (E6-DESIGN T1a/T1b). */
export function rotuloAbaOrcamento(tipo: TipoContrato): string {
  return tipo === "administracao" ? "Custos" : "Etapas";
}
export function rotuloAbaPagamentos(tipo: TipoContrato): string {
  return tipo === "administracao" ? "Pagamentos" : "Medições";
}

// ── Orçamento (cabeçalho/frente — Gate 1) ────────────────────────────────────
export const STATUS_ORCAMENTO = [
  "rascunho",
  "enviado",
  "aprovado",
  "rejeitado",
  "cancelado",
] as const;
export type StatusOrcamento = (typeof STATUS_ORCAMENTO)[number];

export function isStatusOrcamento(v: string): v is StatusOrcamento {
  return (STATUS_ORCAMENTO as readonly string[]).includes(v);
}

export const APRESENTACAO_STATUS_ORCAMENTO: Record<
  StatusOrcamento,
  { cor: string; label: string }
> = {
  rascunho: { cor: "#8b949e", label: "Rascunho" },
  enviado: { cor: "#3B82F6", label: "Enviado" },
  aprovado: { cor: "#3fb950", label: "Aprovado" },
  rejeitado: { cor: "#EF4444", label: "Rejeitado" },
  cancelado: { cor: "#6e7681", label: "Cancelado" },
};

// ── Escrow do orçamento (custódia) ───────────────────────────────────────────
export const STATUS_ESCROW = [
  "sem_custodia",
  "aguardando_deposito",
  "em_custodia",
  "liberado",
  "devolvido",
] as const;
export type StatusEscrow = (typeof STATUS_ESCROW)[number];

export function isStatusEscrow(v: string): v is StatusEscrow {
  return (STATUS_ESCROW as readonly string[]).includes(v);
}

// ── Pagamento (parcela — Gate 2 DUPLO) ───────────────────────────────────────
export const TIPOS_PAGAMENTO = [
  "medicao",
  "adiantamento",
  "retencao",
  "aditivo",
  "reembolso",
  "avulso",
] as const;
export type TipoPagamento = (typeof TIPOS_PAGAMENTO)[number];

export function isTipoPagamento(v: string): v is TipoPagamento {
  return (TIPOS_PAGAMENTO as readonly string[]).includes(v);
}

/** Tipos que NÃO passam por escrow/orçamento (item avulso "sem escrow" — honestidade na UI). */
export const TIPOS_PAGAMENTO_SEM_ESCROW: readonly TipoPagamento[] = ["avulso", "reembolso"];

export function pagamentoSemEscrow(tipo: TipoPagamento): boolean {
  return (TIPOS_PAGAMENTO_SEM_ESCROW as readonly string[]).includes(tipo);
}

export const STATUS_PAGAMENTO = [
  "bloqueado",
  "liberado",
  "autorizado",
  "em_custodia",
  "pago",
  "cancelado",
] as const;
export type StatusPagamento = (typeof STATUS_PAGAMENTO)[number];

export function isStatusPagamento(v: string): v is StatusPagamento {
  return (STATUS_PAGAMENTO as readonly string[]).includes(v);
}

/** Status em que o pagamento pode ainda vencer/ser cobrado (entra no balde de atraso/vencimento). */
export const STATUS_PAGAMENTO_LIBERAVEIS: readonly StatusPagamento[] = [
  "liberado",
  "autorizado",
  "em_custodia",
];

export const APRESENTACAO_STATUS_PAGAMENTO: Record<
  StatusPagamento,
  { cor: string; label: string; icone: string }
> = {
  bloqueado: { cor: "#6e7681", label: "Bloqueado", icone: "⛔" },
  liberado: { cor: "#3B82F6", label: "Liberado", icone: "🔓" },
  autorizado: { cor: "#c9a24a", label: "Autorizado", icone: "✓" },
  em_custodia: { cor: "#8B5CF6", label: "Em custódia", icone: "🛡" },
  pago: { cor: "#3fb950", label: "Pago", icone: "✅" },
  cancelado: { cor: "#6e7681", label: "Cancelado", icone: "✕" },
};

// ── Aprovação dupla (arquitetura + Hub) — espelha os 3 tipos novos de hub_aprovacoes ──
export const TIPOS_APROVACAO_E6 = [
  "orcamento_frente", // Gate 1
  "pagamento_obra_arq", // Gate 2 chave 1 (arquitetura)
  "pagamento_obra_hub", // Gate 2 chave 2 (Hub — o juiz)
] as const;
export type TipoAprovacaoE6 = (typeof TIPOS_APROVACAO_E6)[number];

export function isTipoAprovacaoE6(v: string): v is TipoAprovacaoE6 {
  return (TIPOS_APROVACAO_E6 as readonly string[]).includes(v);
}

export type PapelChave = "arquitetura" | "hub";

export const APRESENTACAO_APROVACAO_E6: Record<
  TipoAprovacaoE6,
  { label: string; icone: string; papel: PapelChave | null }
> = {
  orcamento_frente: { label: "Orçamento da frente", icone: "💰", papel: null },
  pagamento_obra_arq: { label: "Pagamento · chave Arquitetura", icone: "💳", papel: "arquitetura" },
  pagamento_obra_hub: { label: "Pagamento · chave Hub", icone: "💳", papel: "hub" },
};

// ── Estado da aprovação dupla (qual das 2 portas falta) ──────────────────────
export type EstadoChave = "aprovado" | "pendente" | "rejeitado" | "ausente";

export type EstadoDupla = {
  arq: EstadoChave;
  hub: EstadoChave;
  /** True só quando AMBAS estão aprovadas → o escrow pode liberar. */
  completa: boolean;
  /** Próxima chave que falta (para o rótulo do botão "Aprovar como …"). */
  faltam: PapelChave[];
};

/**
 * Deriva o estado da aprovação dupla a partir do status de cada chave (cada uma é um registro
 * em hub_aprovacoes). O escrow só libera quando arq E hub estão 'aprovado'. Uma chave 'ausente'
 * (registro ainda não criado) conta como pendente — nunca como aprovada (fail-closed).
 */
export function derivarEstadoDupla(
  statusArq: string | null | undefined,
  statusHub: string | null | undefined
): EstadoDupla {
  const arq = normalizarChave(statusArq);
  const hub = normalizarChave(statusHub);
  const completa = arq === "aprovado" && hub === "aprovado";
  const faltam: PapelChave[] = [];
  if (arq !== "aprovado") faltam.push("arquitetura");
  if (hub !== "aprovado") faltam.push("hub");
  return { arq, hub, completa, faltam };
}

function normalizarChave(status: string | null | undefined): EstadoChave {
  const s = (status ?? "").trim().toLowerCase();
  if (!s) return "ausente";
  if (s === "aprovado" || s === "aprovada") return "aprovado";
  if (s === "rejeitado" || s === "rejeitada" || s === "cancelada") return "rejeitado";
  return "pendente";
}

// ── Compatibilização / cobertura (🟢🟡🔴 + %) ───────────────────────────────
export type EstadoCobertura = "coberto" | "parcial" | "sem_orcamento";

export const APRESENTACAO_COBERTURA: Record<
  EstadoCobertura,
  { cor: string; emoji: string; label: string }
> = {
  coberto: { cor: "#3fb950", emoji: "🟢", label: "Coberto" },
  parcial: { cor: "#F59E0B", emoji: "🟡", label: "Parcial / pendente" },
  sem_orcamento: { cor: "#EF4444", emoji: "🔴", label: "Sem orçamento" },
};

export type CoberturaItemInput = {
  valor_contrato: number | null | undefined;
  /** Total orçado APROVADO para o item. */
  orcado_aprovado: number | null | undefined;
  /** Total orçado PENDENTE (enviado, ainda não aprovado) — vira 🟡, não 🟢. */
  orcado_pendente?: number | null | undefined;
};

export type CoberturaItemSaida = {
  estado: EstadoCobertura;
  /** % cobertura (orçado aprovado ÷ contratado × 100). NULL quando não há valor de contrato. */
  pct_cobertura: number | null;
  /** True quando o orçado supera o contratado (aditivo legítimo — badge, não erro). */
  eh_aditivo: boolean;
};

/**
 * Classifica a cobertura de UM item (compatibilização). 3 estados (não 2):
 *  - 🔴 sem_orcamento: nada aprovado E nada pendente;
 *  - 🟡 parcial: cobertura aprovada < 100% OU só há orçamento pendente (evita "pendente parecer coberto");
 *  - 🟢 coberto: cobertura aprovada ≥ 100%.
 * pct_cobertura = NULL quando valor_contrato é nulo/zero (UI mostra "—%", nunca NaN).
 */
export function classificarCobertura(item: CoberturaItemInput): CoberturaItemSaida {
  const contrato = numero(item.valor_contrato);
  const aprovado = numero(item.orcado_aprovado);
  const pendente = numero(item.orcado_pendente);

  const pct = contrato > 0 ? Math.round((aprovado / contrato) * 100) : null;
  const eh_aditivo = contrato > 0 && aprovado > contrato;

  let estado: EstadoCobertura;
  if (aprovado <= 0 && pendente <= 0) {
    estado = "sem_orcamento";
  } else if (contrato > 0 && aprovado >= contrato) {
    estado = "coberto";
  } else {
    estado = "parcial";
  }
  return { estado, pct_cobertura: pct, eh_aditivo };
}

// ── Atraso de pagamento (DERIVADO — uma fonte de verdade, nunca coluna) ──────
/**
 * 'atrasado' = pagamento ainda A PAGAR (liberado/autorizado, fora da custódia) E vencimento < hoje.
 * em_custodia NÃO é atraso de pagamento: o dinheiro já está no cofre aguardando repasse. Derivado
 * na UI/endpoint; o job diário só confirma o balde (não cria coluna).
 */
export function pagamentoAtrasado(
  status: string,
  dataVencimento: string | null | undefined,
  hojeISO: string
): boolean {
  if (!dataVencimento) return false;
  if (status !== "liberado" && status !== "autorizado") return false;
  return soDataISO(dataVencimento) < soDataISO(hojeISO);
}

export type BaldePagamento = "a_pagar" | "vencendo_7d" | "atrasado" | "em_custodia" | "pago" | "fora";

/**
 * Classifica o pagamento num ÚNICO balde (MUTUAMENTE EXCLUSIVOS — clareza pro gestor).
 * Por STATUS primeiro: 'em_custodia' é seu próprio balde (o dinheiro já saiu do cliente e está no
 * cofre aguardando repasse) — NÃO conta como "a pagar". Só os liberáveis fora da custódia
 * (liberado/autorizado) caem nos baldes de prazo (a_pagar / vence 7d / atrasado).
 */
export function baldePagamento(
  status: string,
  dataVencimento: string | null | undefined,
  hojeISO: string
): BaldePagamento {
  if (status === "pago") return "pago";
  if (status === "em_custodia") return "em_custodia"; // cofre, não prazo
  if (status === "cancelado" || status === "bloqueado") return "fora";
  if (status !== "liberado" && status !== "autorizado") return "fora";
  if (!dataVencimento) return "a_pagar";
  const venc = soDataISO(dataVencimento);
  const hoje = soDataISO(hojeISO);
  if (venc < hoje) return "atrasado";
  const dias = diasEntreISO(hoje, venc);
  if (dias <= 7) return "vencendo_7d";
  return "a_pagar";
}

// ── Spread honesto (gerenciamento na administração) ──────────────────────────
/**
 * Mensagem do spread como ECONOMIA (volume/atacado), nunca markup escondido. Só na administração
 * (gestão aberta) o spread é exibido por linha rotulado "gerenciamento". Retorna null quando não há
 * spread declarado (na administração a UI deve recusar render de linha sem spread — guard de produto).
 */
export function rotuloSpreadAdministracao(
  spreadPct: number | null | undefined,
  economiaReais?: number | null
): string | null {
  const pct = numero(spreadPct);
  if (pct <= 0) return null;
  const economia =
    economiaReais != null && Number.isFinite(Number(economiaReais)) && Number(economiaReais) > 0
      ? ` (R$${Math.round(Number(economiaReais)).toLocaleString("pt-BR")} poupados)`
      : "";
  return `gerenciamento ${pct}% declarado${economia}`;
}

// ── Helpers numéricos/data ───────────────────────────────────────────────────
function numero(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function soDataISO(v: string): string {
  // "2026-06-29T..." ou "2026-06-29" → "2026-06-29" (comparação lexicográfica segura)
  return (v ?? "").slice(0, 10);
}

function diasEntreISO(aISO: string, bISO: string): number {
  const a = new Date(`${soDataISO(aISO)}T00:00:00Z`).getTime();
  const b = new Date(`${soDataISO(bISO)}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

// ── Resumo financeiro (cabeçalho da aba) ─────────────────────────────────────
export type ResumoFinanceiro = {
  previsto: number; // soma de valor_contrato dos itens (E2)
  orcado: number; // soma de orçamentos (todos os status não-cancelados)
  aprovado: number; // soma de orçamentos aprovados
  em_custodia: number; // escrow em custódia
  liberado: number; // escrow liberado
  a_pagar: number;
  vencendo_7d: number;
  atrasado: number;
  aguarda_2a_chave: number; // pagamentos liberados aguardando a 2ª chave
};

export function resumoFinanceiroVazio(): ResumoFinanceiro {
  return {
    previsto: 0,
    orcado: 0,
    aprovado: 0,
    em_custodia: 0,
    liberado: 0,
    a_pagar: 0,
    vencendo_7d: 0,
    atrasado: 0,
    aguarda_2a_chave: 0,
  };
}
