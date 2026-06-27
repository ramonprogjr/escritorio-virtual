/**
 * FASE 4 — Catálogo de tarefas típicas por setor (Click-and-Go).
 *
 * Tarefas curtas, acionáveis e em pt-BR. São chips de múltipla escolha no wizard.
 * NÃO há tabela `hub_tarefas` própria de agente: persistimos as escolhidas como
 * uma secção de conhecimento (`conhecimento_secoes`) no payload de criação — ver
 * comentário em AgenteNovoWizard.tsx (`montarSecaoTarefasMd`).
 *
 * `id` é estável (slug) para servir de chave de selecção; `label` é o texto exibido.
 */

import type { SetorAgente } from "@/lib/hub/agente-setor";

export type TarefaSetor = { id: string; label: string };

export const TAREFAS_POR_SETOR: Record<SetorAgente, TarefaSetor[]> = {
  atendimento: [
    { id: "atd-responder-5min", label: "Responder novos leads em até 5 minutos" },
    { id: "atd-qualificar-encaminhar", label: "Qualificar e encaminhar para o setor certo" },
    { id: "atd-tirar-duvidas", label: "Tirar dúvidas frequentes do cliente" },
    { id: "atd-registrar-nota", label: "Registrar o resumo da conversa na ficha do cliente" },
    { id: "atd-followup-sem-resposta", label: "Fazer follow-up de quem ficou sem resposta" },
    { id: "atd-agendar-retorno", label: "Agendar retorno ou visita" },
  ],
  comercial: [
    { id: "com-qualificar-lead", label: "Qualificar o lead (orçamento, prazo, decisor)" },
    { id: "com-enviar-proposta", label: "Enviar proposta e apresentar valores" },
    { id: "com-followup-proposta", label: "Fazer follow-up de propostas em aberto" },
    { id: "com-atualizar-pipeline", label: "Atualizar o estágio do negócio no funil" },
    { id: "com-reativar-frios", label: "Reativar leads frios e oportunidades paradas" },
    { id: "com-agendar-reuniao", label: "Agendar reunião de fechamento" },
    { id: "com-registrar-objecoes", label: "Registrar objeções e motivos de perda" },
  ],
  financeiro: [
    { id: "fin-contas-pagar", label: "Conferir contas a pagar do dia" },
    { id: "fin-contas-receber", label: "Acompanhar contas a receber e inadimplência" },
    { id: "fin-cobrar-atrasados", label: "Enviar lembretes de cobrança de boletos atrasados" },
    { id: "fin-emitir-nota", label: "Solicitar emissão de nota fiscal" },
    { id: "fin-conciliar", label: "Conciliar pagamentos recebidos" },
    { id: "fin-fechamento-caixa", label: "Apoiar o fechamento de caixa do dia" },
  ],
  rh: [
    { id: "rh-triar-curriculos", label: "Triar currículos das vagas abertas" },
    { id: "rh-agendar-entrevistas", label: "Agendar entrevistas com candidatos" },
    { id: "rh-onboarding", label: "Conduzir o onboarding de novos colaboradores" },
    { id: "rh-controlar-ferias", label: "Controlar férias e ausências" },
    { id: "rh-pesquisa-clima", label: "Acompanhar pesquisa de clima e feedbacks" },
    { id: "rh-responder-duvidas", label: "Responder dúvidas de benefícios e políticas" },
  ],
  engenharia: [
    { id: "eng-acompanhar-medicoes", label: "Acompanhar medições e avanço da obra" },
    { id: "eng-diario-obra", label: "Registrar o diário de obra" },
    { id: "eng-checar-cronograma", label: "Checar cronograma e curva S" },
    { id: "eng-listar-pendencias", label: "Listar pendências e não conformidades" },
    { id: "eng-solicitar-materiais", label: "Solicitar materiais e cotações" },
    { id: "eng-status-cliente", label: "Enviar status da obra ao cliente" },
  ],
  trafego: [
    { id: "trf-otimizar-meta", label: "Otimizar campanhas no Meta Ads" },
    { id: "trf-otimizar-google", label: "Ajustar lances e palavras no Google Ads" },
    { id: "trf-pausar-baixo-roi", label: "Pausar anúncios com baixo ROI" },
    { id: "trf-relatorio-leads", label: "Gerar relatório de leads e custo por lead" },
    { id: "trf-testar-criativos", label: "Testar novos criativos (A/B)" },
    { id: "trf-acompanhar-orcamento", label: "Acompanhar o orçamento diário das campanhas" },
  ],
  operacoes: [
    { id: "ope-organizar-fila", label: "Organizar a fila de tarefas do dia" },
    { id: "ope-acompanhar-sla", label: "Acompanhar prazos e SLAs" },
    { id: "ope-atualizar-status", label: "Atualizar status de processos em andamento" },
    { id: "ope-escalar-bloqueios", label: "Escalar bloqueios para o responsável" },
    { id: "ope-padronizar-processo", label: "Padronizar e documentar processos (POP)" },
    { id: "ope-relatorio-rotina", label: "Gerar relatório de rotina operacional" },
  ],
  marketing: [
    { id: "mkt-calendario-conteudo", label: "Planejar o calendário de conteúdo" },
    { id: "mkt-acompanhar-metricas", label: "Acompanhar métricas de alcance e engajamento" },
    { id: "mkt-nutrir-leads", label: "Nutrir leads com campanhas e materiais" },
    { id: "mkt-briefing-campanha", label: "Montar briefing de campanha" },
    { id: "mkt-analisar-concorrencia", label: "Analisar concorrência e referências" },
    { id: "mkt-relatorio-resultados", label: "Gerar relatório de resultados de marketing" },
  ],
  conteudo: [
    { id: "cnt-escrever-posts", label: "Escrever posts para redes sociais" },
    { id: "cnt-roteiro-video", label: "Criar roteiros de vídeo e reels" },
    { id: "cnt-revisar-texto", label: "Revisar textos e padronizar o tom da marca" },
    { id: "cnt-otimizar-seo", label: "Otimizar conteúdo para SEO" },
    { id: "cnt-legendas-cta", label: "Escrever legendas com CTA" },
    { id: "cnt-banco-ideias", label: "Manter o banco de ideias de pautas" },
  ],
};

/** Procura o label de uma tarefa pelo id (ou devolve o próprio id como fallback). */
export function labelTarefa(setor: SetorAgente, id: string): string {
  const found = TAREFAS_POR_SETOR[setor]?.find((t) => t.id === id);
  return found?.label ?? id;
}
