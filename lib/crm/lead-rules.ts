import { MOTIVOS_PERDA, type FunilLeadSlug } from "@/lib/crm/pipelines";
import { crmFeatureFlags } from "@/lib/crm/feature-flags";

export type ResultadoQualificacao = { pronto: boolean; motivo: string; faltam: string[] };

/**
 * PRONTIDÃO do lead para direcionar — decisão do dono (06/jul): "pronto" quando tem INTERESSE
 * definido E VALOR estimado (os dois sinais de negócio). É sinal DERIVADO, não etapa do funil —
 * a IA usa isto para auto-sugerir o direcionamento; a ficha mostra o chip. AUDITORIA-CICLO-LEAD-v1.md.
 */
export function avaliarQualificacao(sinais: {
  interesse_principal?: string | null;
  valor_estimado?: number | null;
}): ResultadoQualificacao {
  const temInteresse =
    typeof sinais.interesse_principal === "string" && sinais.interesse_principal.trim().length > 0;
  const temValor = typeof sinais.valor_estimado === "number" && sinais.valor_estimado > 0;
  const faltam: string[] = [];
  if (!temInteresse) faltam.push("interesse");
  if (!temValor) faltam.push("valor");
  const pronto = temInteresse && temValor;
  return {
    pronto,
    faltam,
    motivo: pronto
      ? "Interesse definido e valor estimado — pronto para direcionar."
      : `Falta ${faltam.join(" e ")} para o lead ficar pronto.`,
  };
}

export function validarMudancaEstagioLead(params: {
  estagio_funil?: string | null;
  estagio?: string | null;
  motivo_perda?: string | null;
  proxima_acao?: string | null;
  data_proxima_acao?: string | null;
}): { ok: true } | { ok: false; error: string } {
  const funil = (params.estagio_funil ?? params.estagio ?? "").trim();

  if (funil === "perdido" || funil === "spam_invalido" || params.estagio === "perdido") {
    if (!params.motivo_perda?.trim()) {
      return { ok: false, error: "Informe o motivo da perda." };
    }
    const motivo = params.motivo_perda.trim();
    const motivoValido =
      motivo === "outro" ||
      MOTIVOS_PERDA.includes(motivo as (typeof MOTIVOS_PERDA)[number]) ||
      motivo.length >= 4;
    if (!motivoValido) {
      return { ok: false, error: "Motivo de perda inválido." };
    }
  }

  if (crmFeatureFlags.proximaAcaoObrigatoria()) {
    const etapasAtivas: FunilLeadSlug[] = [
      "novo",
      "em_atendimento",
      "aguardando_resposta",
      "qualificando",
      "encaminhado",
    ];
    const slug = (params.estagio_funil ?? params.estagio) as FunilLeadSlug;
    if (etapasAtivas.includes(slug) && !params.proxima_acao?.trim() && !params.data_proxima_acao) {
      return { ok: false, error: "Defina a próxima ação antes de continuar." };
    }
  }

  return { ok: true };
}
