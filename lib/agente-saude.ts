/** Saúde operacional exibida no CRM (heurística local + dados recentes). */
export type AgenteSaudeNivel = "ok" | "degradado" | "parado";

export type CicloLogResumo = {
  status?: string | null;
  iniciado_em?: string | null;
};

const MS_48H = 48 * 60 * 60 * 1000;
const MS_7D = 7 * 24 * 60 * 60 * 1000;
const MS_14D = 14 * 24 * 60 * 60 * 1000;

/**
 * - parado: inativo ou arquivado.
 * - degradado: evidência de falha (última execução erro, 2+ erros nas 5 últimas), execução de ciclo
 *   muito antiga (>14d), ou ciclos ativos sem nenhum log de ciclo mas com último prompt IA antigo (>7d).
 * - ok: demais casos, incluindo agente ativo com ciclos cadastrados mas sem `hub_ciclos_log` ainda
 *   (cenário comum em dev / antes da 1ª execução — doc. mestre §5.4) e agente sem ciclos no catálogo.
 *
 * `hub_prompt_logs` (última resposta no engine) conta como atividade recente e evita falso “degradado”
 * quando o ciclo ainda não incrementou log (CMD-OBS-1 / webhook vs cron).
 */
export function calcularSaudeAgente(params: {
  ativoOperacional: boolean;
  arquivado: boolean;
  ciclosAtivosCount: number;
  logsCiclo: CicloLogResumo[];
  ultimoPromptEm?: string | null;
}): AgenteSaudeNivel {
  if (!params.ativoOperacional || params.arquivado) return "parado";

  const logs = params.logsCiclo || [];
  const last = logs[0];

  if (last?.status === "erro") return "degradado";

  const ult5 = logs.slice(0, 5);
  if (ult5.filter((l) => l.status === "erro").length >= 2) return "degradado";

  if (params.ultimoPromptEm) {
    const pt = new Date(params.ultimoPromptEm).getTime();
    if (!Number.isNaN(pt) && Date.now() - pt < MS_48H) return "ok";
  }

  if (params.ciclosAtivosCount === 0 && logs.length === 0) return "ok";

  if (last?.iniciado_em) {
    const lt = new Date(last.iniciado_em).getTime();
    if (!Number.isNaN(lt) && Date.now() - lt > MS_14D) return "degradado";
  }

  if (params.ciclosAtivosCount > 0 && logs.length === 0 && params.ultimoPromptEm) {
    const pt = new Date(params.ultimoPromptEm).getTime();
    if (!Number.isNaN(pt) && Date.now() - pt > MS_7D) return "degradado";
  }

  return "ok";
}

export const SAUDE_CORES: Record<AgenteSaudeNivel, { bg: string; fg: string; label: string }> = {
  ok: { bg: "#14532d", fg: "#86efac", label: "OK" },
  degradado: { bg: "#713f12", fg: "#fde047", label: "Degradado" },
  parado: { bg: "#450a0a", fg: "#fecaca", label: "Parado" },
};
