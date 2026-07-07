/**
 * Ciclo de vida da PROPOSTA (hub_propostas) — fonte única de cor/rótulo/transições, reusada pela
 * ficha do lead (onde se CRIA) e pela ficha do negócio (read-only). 7 estados + cancelada legada.
 * Desenho: docs/AUDITORIA-CICLO-LEAD-v1.md / mesa Fable P2.
 */
export type PropostaStatus =
  | "rascunho"
  | "aguardando_aprovacao"
  | "aprovada"
  | "enviada"
  | "aceita"
  | "recusada"
  | "expirada";

export const PROPOSTA_STATUS_COR: Record<string, string> = {
  rascunho: "#8b949e",
  aguardando_aprovacao: "#e3b341", // âmbar
  aprovada: "#34d399",
  enviada: "#c9a24a", // dourado
  aceita: "#34d399", // verde
  recusada: "#f87171", // vermelho
  expirada: "#6b7280", // cinza-escuro
  cancelada: "#f87171", // legado
};

export const PROPOSTA_STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  aguardando_aprovacao: "Aguardando",
  aprovada: "Aprovada",
  enviada: "Enviada",
  aceita: "Aceita",
  recusada: "Recusada",
  expirada: "Expirada",
  cancelada: "Cancelada",
};

export function propostaStatusCor(status: string | null | undefined): string {
  return PROPOSTA_STATUS_COR[(status || "").toLowerCase()] ?? "#8b949e";
}

export function propostaStatusLabel(status: string | null | undefined): string {
  const s = (status || "").toLowerCase();
  return PROPOSTA_STATUS_LABEL[s] ?? (status || "—");
}

/** Transições válidas por estado (o servidor valida; o cliente mostra os botões certos). */
export const PROPOSTA_TRANSICOES: Record<string, PropostaStatus[]> = {
  rascunho: ["enviada", "aguardando_aprovacao"],
  aguardando_aprovacao: ["aprovada", "rascunho"],
  aprovada: ["enviada"],
  enviada: ["aceita", "recusada", "expirada"],
  expirada: ["enviada"],
  aceita: [],
  recusada: [],
};

export function transicaoValida(de: string | null | undefined, para: string): boolean {
  const origem = (de || "rascunho").toLowerCase();
  return (PROPOSTA_TRANSICOES[origem] ?? []).includes(para as PropostaStatus);
}

/** Dias restantes até expirar (enviada_em + validade_dias). null se não enviada. */
export function diasParaExpirar(enviada_em: string | null | undefined, validade_dias: number | null | undefined): number | null {
  if (!enviada_em) return null;
  const base = new Date(enviada_em).getTime();
  if (!Number.isFinite(base)) return null;
  const validade = Number(validade_dias) > 0 ? Number(validade_dias) : 7;
  const fim = base + validade * 24 * 3600 * 1000;
  return Math.ceil((fim - Date.now()) / (24 * 3600 * 1000));
}
