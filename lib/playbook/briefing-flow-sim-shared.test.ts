import { describe, expect, it } from "vitest";
import {
  emptyBriefingFlowSimState,
  resolverFlowStateParaSimulacao,
} from "./briefing-flow-sim-shared";
import { BRIEFING_FLOW_SIM_STATE_KEY } from "./briefing-flow-sim-shared";

describe("resolverFlowStateParaSimulacao", () => {
  it("recupera step do último assistant quando body vem vazio", () => {
    const recovered = resolverFlowStateParaSimulacao(emptyBriefingFlowSimState(), [
      { papel: "user" },
      {
        papel: "assistant",
        metadata: {
          [BRIEFING_FLOW_SIM_STATE_KEY]: {
            step: "triagem_servicos_menu",
            answers: { nome: "Lucas" },
            active: true,
            complete: false,
            handoff_ia: false,
          },
        },
      },
    ]);
    expect(recovered.step).toBe("triagem_servicos_menu");
    expect(recovered.answers.nome).toBe("Lucas");
  });

  it("prioriza body quando já tem step", () => {
    const body = {
      step: "coletar_nome",
      answers: {},
      active: true,
      complete: false,
      handoff_ia: false,
    };
    const recovered = resolverFlowStateParaSimulacao(body, [
      {
        papel: "assistant",
        metadata: {
          [BRIEFING_FLOW_SIM_STATE_KEY]: {
            step: "triagem_servicos_menu",
            answers: {},
            active: true,
            complete: false,
            handoff_ia: false,
          },
        },
      },
    ]);
    expect(recovered.step).toBe("coletar_nome");
  });
});
