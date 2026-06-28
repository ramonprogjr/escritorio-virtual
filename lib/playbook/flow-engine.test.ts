import { afterEach, describe, expect, it, vi } from "vitest";
import {
  executeFlowEngine,
  formatMenuOpcoesTexto,
  normMenuChoiceText,
  resolveMenuChoiceId,
  type FlowEngineDefinition,
} from "./flow-engine";

afterEach(() => {
  vi.unstubAllEnvs();
});

const MENU_CHOICES = [
  { id: "m2_50_100", label: "De 50 a 100 m2" },
  { id: "m2_100_200", label: "De 100 a 200 m2" },
  { id: "m2_acima_200", label: "Acima de 200 m2" },
];

describe("resolveMenuChoiceId", () => {
  it("mapeia resposta numérica 1..n para o id da opção", () => {
    expect(resolveMenuChoiceId("1", null, MENU_CHOICES)).toBe("m2_50_100");
    expect(resolveMenuChoiceId("2", null, MENU_CHOICES)).toBe("m2_100_200");
    expect(resolveMenuChoiceId("3", null, MENU_CHOICES)).toBe("m2_acima_200");
  });

  it("aceita texto livre igual ou parecido com o rótulo", () => {
    expect(resolveMenuChoiceId("De 50 a 100 m2", null, MENU_CHOICES)).toBe("m2_50_100");
    expect(resolveMenuChoiceId("De 50 a 100 m²", null, MENU_CHOICES)).toBe("m2_50_100");
    expect(resolveMenuChoiceId("de 50 a 100 m2", null, MENU_CHOICES)).toBe("m2_50_100");
  });

  it("aceita id direto e formato label|id", () => {
    expect(resolveMenuChoiceId("m2_100_200", null, MENU_CHOICES)).toBe("m2_100_200");
    expect(resolveMenuChoiceId("De 100 a 200 m2|m2_100_200", null, MENU_CHOICES)).toBe(
      "m2_100_200"
    );
  });

  it("usa aliases globais quando o id pertence ao menu atual", () => {
    const global = (msg: string) => (msg === "Até 50" ? "arq_m2_ate50" : null);
    const choices = [
      { id: "arq_m2_ate50", label: "Até 50 m²" },
      { id: "arq_m2_51_250", label: "51-250 m²" },
    ];
    expect(resolveMenuChoiceId("Até 50", null, choices, global)).toBe("arq_m2_ate50");
  });
});

describe("normMenuChoiceText", () => {
  it("normaliza m² e pontuação", () => {
    expect(normMenuChoiceText("De 50 a 100 m²")).toBe("de 50 a 100 m2");
  });
});

describe("formatMenuOpcoesTexto", () => {
  it("monta lista numerada no corpo da mensagem", () => {
    const text = formatMenuOpcoesTexto("Qual o tamanho?", MENU_CHOICES);
    expect(text).toContain("Qual o tamanho?");
    expect(text).toContain("1. De 50 a 100 m2");
    expect(text).toContain("3. Acima de 200 m2");
  });
});

describe("executeFlowEngine send_text", () => {
  it("agrupa mensagens consecutivas send_text num único envio", async () => {
    const sendText = vi.fn(async () => {});
    const definition: FlowEngineDefinition = {
      start_step: "a",
      steps: {
        a: { id: "a", type: "send_text", text: "Olá", next_step: "b" },
        b: { id: "b", type: "send_text", text: "Sou a Mari", next_step: "c" },
        c: { id: "c", type: "ask_text", prompt: "Seu nome?", answer_key: "nome", next_step: "fim" },
        fim: { id: "fim", type: "complete" },
      },
    };

    await executeFlowEngine(
      definition,
      { step: null, answers: {}, mensagem: "oi", tipoMidia: "texto" },
      {
        sendText,
        sendMenu: async () => ({ ok: true }),
        resolveChoiceId: () => null,
        persistState: async () => {},
      }
    );

    expect(sendText).toHaveBeenCalledTimes(2);
    expect(sendText.mock.calls[0][0]).toBe("Olá\n\nSou a Mari");
    expect(sendText.mock.calls[1][0]).toBe("Seu nome?");
  });

  it("envia em bolhas separadas quando split=true (quebra por \\n\\n)", async () => {
    vi.stubEnv("FLOW_SPLIT_BUBBLE_DELAY_MS", "0");
    const sendText = vi.fn(async () => {});
    const definition: FlowEngineDefinition = {
      start_step: "a",
      steps: {
        a: {
          id: "a",
          type: "send_text",
          text: "Primeira bolha\n\nSegunda bolha\n\nTerceira bolha",
          split: true,
          next_step: "fim",
        },
        fim: { id: "fim", type: "complete" },
      },
    };

    await executeFlowEngine(
      definition,
      { step: null, answers: {}, mensagem: "oi", tipoMidia: "texto" },
      {
        sendText,
        sendMenu: async () => ({ ok: true }),
        resolveChoiceId: () => null,
        persistState: async () => {},
      }
    );

    expect(sendText).toHaveBeenCalledTimes(3);
    expect(sendText.mock.calls[0][0]).toBe("Primeira bolha");
    expect(sendText.mock.calls[1][0]).toBe("Segunda bolha");
    expect(sendText.mock.calls[2][0]).toBe("Terceira bolha");
  });

  it("não concatena um step split com vizinhos sem split", async () => {
    vi.stubEnv("FLOW_SPLIT_BUBBLE_DELAY_MS", "0");
    const sendText = vi.fn(async () => {});
    const definition: FlowEngineDefinition = {
      start_step: "a",
      steps: {
        a: { id: "a", type: "send_text", text: "Intro", next_step: "b" },
        b: { id: "b", type: "send_text", text: "Bolha 1\n\nBolha 2", split: true, next_step: "c" },
        c: { id: "c", type: "send_text", text: "Fecho", next_step: "fim" },
        fim: { id: "fim", type: "complete" },
      },
    };

    await executeFlowEngine(
      definition,
      { step: null, answers: {}, mensagem: "oi", tipoMidia: "texto" },
      {
        sendText,
        sendMenu: async () => ({ ok: true }),
        resolveChoiceId: () => null,
        persistState: async () => {},
      }
    );

    // Intro (concat) | Bolha 1 | Bolha 2 | Fecho (concat) = 4 envios
    expect(sendText).toHaveBeenCalledTimes(4);
    expect(sendText.mock.calls[0][0]).toBe("Intro");
    expect(sendText.mock.calls[1][0]).toBe("Bolha 1");
    expect(sendText.mock.calls[2][0]).toBe("Bolha 2");
    expect(sendText.mock.calls[3][0]).toBe("Fecho");
  });
});

describe("executeFlowEngine send_media", () => {
  it("chama sendMedia com o tipo/url do passo e segue para next_step", async () => {
    const sendText = vi.fn(async () => {});
    const sendMedia = vi.fn(async () => ({ ok: true }));
    const definition: FlowEngineDefinition = {
      start_step: "doc",
      steps: {
        doc: {
          id: "doc",
          type: "send_media",
          media_type: "document",
          file: "https://exemplo.com/contrato.pdf",
          caption: "Segue o contrato",
          file_name: "Contrato.pdf",
          next_step: "fim",
        },
        fim: { id: "fim", type: "complete", text: "Pronto!" },
      },
    };

    await executeFlowEngine(
      definition,
      { step: null, answers: {}, mensagem: "oi", tipoMidia: "texto" },
      {
        sendText,
        sendMedia,
        sendMenu: async () => ({ ok: true }),
        resolveChoiceId: () => null,
        persistState: async () => {},
      }
    );

    expect(sendMedia).toHaveBeenCalledTimes(1);
    expect(sendMedia.mock.calls[0][0]).toMatchObject({
      mediaType: "document",
      file: "https://exemplo.com/contrato.pdf",
      caption: "Segue o contrato",
      fileName: "Contrato.pdf",
    });
    // chegou ao complete e enviou o texto final
    expect(sendText).toHaveBeenCalledWith("Pronto!");
  });

  it("não derruba o fluxo quando o adapter não suporta mídia (envia a legenda como texto)", async () => {
    const sendText = vi.fn(async () => {});
    const definition: FlowEngineDefinition = {
      start_step: "doc",
      steps: {
        doc: {
          id: "doc",
          type: "send_media",
          media_type: "document",
          file: "https://exemplo.com/x.pdf",
          caption: "Veja o anexo",
        },
        fim: { id: "fim", type: "complete" },
      },
    };

    const result = await executeFlowEngine(
      definition,
      { step: null, answers: {}, mensagem: "oi", tipoMidia: "texto" },
      {
        sendText,
        // sem sendMedia
        sendMenu: async () => ({ ok: true }),
        resolveChoiceId: () => null,
        persistState: async () => {},
      }
    );

    expect(result.handled).toBe(true);
    expect(sendText).toHaveBeenCalledWith("Veja o anexo");
  });
});

describe("executeFlowEngine menu", () => {
  const definition: FlowEngineDefinition = {
    start_step: "arq_tamanho",
    steps: {
      arq_tamanho: {
        id: "arq_tamanho",
        type: "menu",
        text: "Qual o tamanho?",
        answer_key: "arq_tamanho",
        choices: MENU_CHOICES.map((c) => ({ ...c, next_step: "arq_prazo" })),
      },
      arq_prazo: {
        id: "arq_prazo",
        type: "ask_text",
        prompt: "Cidade?",
        answer_key: "cidade",
        next_step: "concluido",
      },
      concluido: { id: "concluido", type: "complete" },
    },
  };

  it("avança com resposta numérica e grava answer_key", async () => {
    const persistState = vi.fn().mockResolvedValue(undefined);
    const sendMenu = vi.fn().mockResolvedValue({ ok: true });

    const result = await executeFlowEngine(
      definition,
      {
        step: "arq_tamanho",
        answers: {},
        mensagem: "2",
        tipoMidia: "texto",
      },
      {
        sendText: vi.fn().mockResolvedValue(undefined),
        sendMenu,
        resolveChoiceId: () => null,
        persistState,
      }
    );

    expect(result).toEqual({ handled: true, skipIa: true, step: "arq_prazo" });
    expect(sendMenu).not.toHaveBeenCalled();
    const persistedToPrazo = persistState.mock.calls.find(
      (call) => call[0]?.step === "arq_prazo" && call[0]?.answers?.arq_tamanho === "m2_100_200"
    );
    expect(persistedToPrazo).toBeTruthy();
  });

  it("envia opções numeradas quando menu_type=text", async () => {
    const persistState = vi.fn().mockResolvedValue(undefined);
    const sendText = vi.fn().mockResolvedValue(undefined);
    const sendMenu = vi.fn().mockResolvedValue({ ok: true });

    const textDefinition: FlowEngineDefinition = {
      ...definition,
      steps: {
        ...definition.steps,
        arq_tamanho: {
          ...(definition.steps.arq_tamanho as { type: "menu" }),
          menu_type: "text",
        },
      },
    };

    await executeFlowEngine(
      textDefinition,
      {
        step: null,
        answers: {},
        mensagem: "",
        tipoMidia: "texto",
      },
      {
        sendText,
        sendMenu,
        resolveChoiceId: () => null,
        persistState,
      }
    );

    expect(sendMenu).not.toHaveBeenCalled();
    expect(sendText).toHaveBeenCalledWith(
      expect.stringContaining("1. De 50 a 100 m2")
    );
  });
});
