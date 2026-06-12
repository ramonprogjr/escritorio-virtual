/** Status de homologação em pessoa/empresa (PDF Pt.9) — convive com hub_parceiros. */

export const HOMOLOGACAO_STATUS = [
  "nao_homologado",
  "em_homologacao",
  "homologado",
  "suspenso",
] as const;

export type HomologacaoStatus = (typeof HOMOLOGACAO_STATUS)[number];

export const HOMOLOGACAO_STATUS_LABEL: Record<HomologacaoStatus, string> = {
  nao_homologado: "Não homologado",
  em_homologacao: "Em homologação",
  homologado: "Homologado",
  suspenso: "Suspenso",
};

export function lerHomologacaoDeDadosExtras(dados?: Record<string, unknown> | null): HomologacaoStatus {
  const raw = dados?.homologacao_status ?? dados?.status_homologacao;
  const s = typeof raw === "string" ? raw.trim() : "";
  if (HOMOLOGACAO_STATUS.includes(s as HomologacaoStatus)) return s as HomologacaoStatus;
  return "nao_homologado";
}
