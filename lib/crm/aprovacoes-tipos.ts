/**
 * FONTE ÚNICA dos tipos de aprovação que envolvem DINHEIRO (gate dourado E6).
 *
 * MOTIVO (auditoria QA): a fila /crm/aprovacoes e o painel financeiro divergiam — a fila
 * usava os tipos REAIS (`orcamento_frente`, `pagamento_obra_arq/hub`, `cotacao_fornecedor`),
 * mas `finance-dashboard-aggregate` filtrava por `['pagamento','financeiro']` (tipos que NÃO
 * existem) → a lista de aprovações financeiras do dashboard vinha SEMPRE vazia (o escrow real
 * nunca aparecia). Centralizar aqui evita o drift voltar.
 *
 * Espelha o CHECK/uso em app/crm/obras/[id]/financeiro/route.ts e lib/ia/aprovacoes.ts.
 */
export const TIPOS_APROVACAO_DINHEIRO = [
  "orcamento_frente",
  "pagamento_obra_arq",
  "pagamento_obra_hub",
  "cotacao_fornecedor",
] as const;

export type TipoAprovacaoDinheiro = (typeof TIPOS_APROVACAO_DINHEIRO)[number];

/** Set pronto para checagem O(1) de "este tipo é do gate do dinheiro?". */
export const TIPOS_APROVACAO_DINHEIRO_SET: ReadonlySet<string> = new Set(
  TIPOS_APROVACAO_DINHEIRO
);

/**
 * SUBCONJUNTO ESTREITO das CHAVES DE ESCROW (Onda 2) — os únicos tipos que o portador
 * de `escrow:chave_*` que NÃO é gestor (architect/operation) pode ver e assinar.
 *
 * NÃO reusar TIPOS_APROVACAO_DINHEIRO aqui: aquele Set inclui `orcamento_frente` e
 * `cotacao_fornecedor`, que são alçada COMERCIAL — o dono pediu explicitamente que NÃO
 * apareçam ao arquiteto/engenharia. Esta lista espelha 1:1 o predicado `ehChaveEscrow`
 * de aprovar()/rejeitar() em lib/ia/aprovacoes.ts (fila de leitura = gate de escrita).
 */
export const TIPOS_ESCROW_CHAVE_TECNICA = [
  "pagamento_obra_arq",
  "pagamento_obra_hub",
] as const;

export type TipoEscrowChaveTecnica = (typeof TIPOS_ESCROW_CHAVE_TECNICA)[number];
