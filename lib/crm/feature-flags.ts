/** Feature flags CRM (env na Render ou .env.local). */

function envBool(key: string, defaultValue = false): boolean {
  const v = process.env[key]?.trim().toLowerCase();
  if (!v) return defaultValue;
  return v === "1" || v === "true" || v === "yes";
}

/** NEXT_PUBLIC_* no cliente: acesso literal (webpack não substitui process.env[chave dinâmica]). */
function publicEnvBool(value: string | undefined, defaultValue = false): boolean {
  const v = value?.trim().toLowerCase();
  if (!v) return defaultValue;
  return v === "1" || v === "true" || v === "yes";
}

export const crmFeatureFlags = {
  pipelineV2: () => envBool("CRM_PIPELINE_V2", true),
  encaminhamentoV2: () => envBool("CRM_ENCAMINHAMENTO_V2", true),
  distribuicaoAuto: () => envBool("CRM_DISTRIBUICAO_AUTO", true),
  proximaAcaoObrigatoria: () => envBool("CRM_PROXIMA_ACAO_OBRIGATORIA"),
  logsAuditoria: () => envBool("CRM_LOGS_AUDITORIA", true),
  /** IA cria PES+LED via tool hub_crm_criar_cadastro — default off em prod */
  iaAutoCadastro: () => envBool("CRM_IA_AUTO_CADASTRO", false),
  /** Grava parceiro no lead e PAR no NEG ao converter — default off em prod */
  vinculoParceiroAuto: () => envBool("CRM_VINCULO_PARCEIRO_AUTO", false),
  /** UI busca global por código de rastreio */
  rastreioBusca: () => envBool("CRM_RASTREIO_BUSCA", true),
  playbookFlowVisualSideover: () =>
    publicEnvBool(
      process.env.NEXT_PUBLIC_CRM_PLAYBOOK_FLOW_VISUAL_SIDEOVER,
      process.env.NODE_ENV === "development"
    ),
  /**
   * Merge de duplicatas de pessoas. Detecção + comparação ficam SEMPRE ligadas;
   * esta flag protege apenas a ação REAL de mesclar (POST). Default OFF: o dono
   * liga após aprovar o 1º par real ("em homologação" até lá). NEXT_PUBLIC_* para
   * o botão da tela ler o mesmo estado que a API valida.
   */
  mergeDuplicatas: () => publicEnvBool(process.env.NEXT_PUBLIC_CRM_MERGE_DUPLICATAS, false),
} as const;
