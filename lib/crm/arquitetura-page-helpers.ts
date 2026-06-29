/** Helpers da tela /crm/arquitetura — re-exporta defaults do funil + utilitário de nome. */
import {
  ESTAGIOS_PROJETO_FALLBACK_UI,
  ESTAGIO_PROJETO_INICIAL,
} from "@/lib/crm/projeto-funil-defaults";
import { limparNomePipeline } from "@/lib/crm/pipeline-defaults";

export { ESTAGIOS_PROJETO_FALLBACK_UI, ESTAGIO_PROJETO_INICIAL };

/** Limpa o prefixo "<Módulo> — " do nome do pipeline para o subtítulo da página. */
export function limparNomePipelineProjeto(nome: string | null | undefined): string {
  return limparNomePipeline(nome);
}
