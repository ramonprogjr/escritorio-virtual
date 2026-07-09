/**
 * F5 (plano de agentes) — montagem PURA do payload de criação de agente (POST /api/hub/agentes),
 * extraída de AgenteNovoWizard.criarAgente. Habilita a F6 (criar-com-IA): o blueprint da IA aplica
 * pelo MESMO caminho do wizard. Comportamento idêntico ao inline — garantido por teste de paridade
 * (montar-payload-criacao-agente.test.ts) nos 3 perfis (cargo+canal_whatsapp, cargo+interno, só-playbook).
 *
 * Regra: NÃO alterar a forma do payload aqui sem atualizar o teste de paridade — o servidor depende dela.
 */

export type PayloadCriacaoAgenteInput = {
  nome: string;
  mercados: string[];
  /** já computada pelo caller (gerarPersonalidade) — a lib não deriva personalidade. */
  personalidade: string;
  conhecimentoSecoes: Record<string, string>;
  motorFerramentasHub: boolean;
  mistralProvisionar: boolean;
  usoFerramentasIa: unknown;
  modeloPreferencia: unknown;
  somentePlaybook: boolean;
  /** cargoSelecionado?.slug ?? null */
  cargoSlug: string | null;
  setorAgente: string | null;
  hubCicloEstrategia: string;
  hubCiclosVincularIds: string[];
  modoOperacao: string;
  modoExecucao: string;
  agendaIntervalMin: number;
};

export function montarPayloadCriacaoAgente(input: PayloadCriacaoAgenteInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    nome: input.nome,
    prefixo_mercado: input.mercados.join(","),
    personalidade: input.personalidade,
    system_prompt_base: "",
    conhecimento_secoes: input.conhecimentoSecoes,
    bio: null,
    horario_inicio: "08:00",
    horario_fim: "22:00",
    motor_ferramentas_habilitado: input.motorFerramentasHub,
    mistral_agent_sync_habilitado: input.mistralProvisionar,
    uso_ferramentas_ia: input.usoFerramentasIa,
    modelo_preferencia: input.modeloPreferencia,
  };

  if (input.somentePlaybook) {
    payload.playbook_only = true;
  } else if (input.cargoSlug) {
    payload.cargo_slug = input.cargoSlug;
  }

  // Setor derivado do cargo (Fase 4). Só-playbook não tem cargo → null (o servidor lida com isso).
  payload.setor_ia = input.setorAgente ?? null;

  if (input.hubCicloEstrategia === "somente_vincular") {
    payload.omit_hub_ciclo_padrao = true;
    payload.ciclos_vincular_ids = input.hubCiclosVincularIds;
    payload.modo_operacao = input.modoOperacao;
    payload.ciclo_execucao = input.modoOperacao === "canal_whatsapp" ? "interacao" : input.modoExecucao;
    if (input.modoExecucao === "agenda" && input.modoOperacao !== "canal_whatsapp") {
      payload.ciclo_intervalo_minutos = input.agendaIntervalMin;
    }
  } else {
    payload.modo_operacao = input.modoOperacao;
    payload.ciclo_execucao = input.modoOperacao === "canal_whatsapp" ? "interacao" : input.modoExecucao;
    payload.ciclo_intervalo_minutos = input.modoExecucao === "agenda" ? input.agendaIntervalMin : undefined;
    if (input.hubCiclosVincularIds.length > 0) {
      payload.ciclos_vincular_ids = input.hubCiclosVincularIds;
    }
  }

  return payload;
}
