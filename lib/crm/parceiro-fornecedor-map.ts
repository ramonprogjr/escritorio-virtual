/**
 * Contrato PURO (sem I/O) parceiro → fornecedor.
 *
 * O motor de distribuição (lib/crm/distribuir-lead.ts → listarCandidatosParceiro)
 * lê `hub_parceiros` casando por `mercado` STRING singular. O shape de fornecedor,
 * porém, trabalha com `mercados[]` + `mercado_principal`. Esta função traduz um
 * parceiro para esse shape sem tocar no banco — para que a Fase A possa unificar
 * as duas telas sobre o mesmo contrato.
 *
 * Regra de ouro (segurança): MENOR PRIVILÉGIO. Só `homologado` vira acesso
 * `aprovado`; qualquer status desconhecido/ausente cai em `pendente`. Nunca
 * homologar por engano um parceiro que o motor poderia então distribuir.
 */

/** Status de homologação do parceiro (coluna `status` em hub_parceiros). */
export type ParceiroStatus = "captacao" | "em_homologacao" | "homologado";

/** Status de acesso no shape de fornecedor (porta da distribuição). */
export type FornecedorStatusAcesso = "aprovado" | "pendente";

/** Forma mínima de entrada — só o que o mapa precisa ler do parceiro. */
export type ParceiroParaMapear = {
  /** `mercado` STRING singular gravado em hub_parceiros (ex.: "IMB"). */
  mercado?: string | null;
  /** Status de homologação; pode vir desconhecido de dados legados. */
  status?: string | null;
};

/** Shape de fornecedor derivado (subconjunto usado pela distribuição). */
export type FornecedorDerivado = {
  /** Lista de mercados — array com o único mercado do parceiro (ou vazio). */
  mercados: string[];
  /** Mercado principal — o `mercado` singular (ou null se vazio). */
  mercado_principal: string | null;
  /** Porta de acesso à distribuição — só `aprovado` quando homologado. */
  status_acesso: FornecedorStatusAcesso;
  /** Status original normalizado (preserva semântica do parceiro). */
  status: ParceiroStatus;
};

/** Normaliza o `mercado` string → { mercados[], mercado_principal }. */
function mapearMercado(mercado: string | null | undefined): {
  mercados: string[];
  mercado_principal: string | null;
} {
  const sigla = typeof mercado === "string" ? mercado.trim() : "";
  if (!sigla) return { mercados: [], mercado_principal: null };
  return { mercados: [sigla], mercado_principal: sigla };
}

/**
 * Mapeia o `status` do parceiro → { status_acesso, status }.
 * - `homologado`            → acesso `aprovado` (entra no motor)
 * - `em_homologacao`        → acesso `pendente`
 * - `captacao`              → acesso `pendente`
 * - desconhecido/ausente    → acesso `pendente` + status `captacao` (menor privilégio)
 */
function mapearStatus(status: string | null | undefined): {
  status_acesso: FornecedorStatusAcesso;
  status: ParceiroStatus;
} {
  const s = typeof status === "string" ? status.trim().toLowerCase() : "";
  switch (s) {
    case "homologado":
      return { status_acesso: "aprovado", status: "homologado" };
    case "em_homologacao":
      return { status_acesso: "pendente", status: "em_homologacao" };
    case "captacao":
      return { status_acesso: "pendente", status: "captacao" };
    default:
      // Menor privilégio: nada que não seja explicitamente homologado entra no motor.
      return { status_acesso: "pendente", status: "captacao" };
  }
}

/** Converte um parceiro para o shape de fornecedor (PURO — sem efeitos colaterais). */
export function parceiroParaFornecedor(parceiro: ParceiroParaMapear): FornecedorDerivado {
  const { mercados, mercado_principal } = mapearMercado(parceiro.mercado);
  const { status_acesso, status } = mapearStatus(parceiro.status);
  return { mercados, mercado_principal, status_acesso, status };
}
