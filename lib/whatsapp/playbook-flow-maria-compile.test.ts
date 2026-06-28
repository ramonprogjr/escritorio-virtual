import { describe, expect, it } from "vitest";
import { compilePlaybookFlowToEngine } from "@/lib/whatsapp/playbook-flow-maria";
import type { PlaybookFlowDefinition } from "@/lib/playbook/flow-definition-types";

describe("compilePlaybookFlowToEngine — novos átomos de mídia/split", () => {
  it("compila send_document para um passo send_media (type document)", () => {
    const def: PlaybookFlowDefinition = {
      obra10_playbook_flow_schema: 1,
      entry_step_id: "doc",
      steps: [
        {
          id: "doc",
          kind: "send_document",
          media: { type: "document", url: "https://x/contrato.pdf", file_name: "Contrato.pdf" },
          message: "Segue o material",
          next: "fim",
        },
        { id: "fim", kind: "complete", complete: { type: "complete", summary: "ok" } },
      ],
    };

    const engine = compilePlaybookFlowToEngine(def);
    const step = engine.steps.doc;
    expect(step.type).toBe("send_media");
    if (step.type === "send_media") {
      expect(step.media_type).toBe("document");
      expect(step.file).toBe("https://x/contrato.pdf");
      expect(step.file_name).toBe("Contrato.pdf");
      expect(step.caption).toBe("Segue o material");
      expect(step.next_step).toBe("fim");
    }
  });

  it("compila send_audio para um passo send_media (type audio)", () => {
    const def: PlaybookFlowDefinition = {
      obra10_playbook_flow_schema: 1,
      entry_step_id: "audio",
      steps: [
        {
          id: "audio",
          kind: "send_audio",
          media: { type: "audio", url: "https://x/boas-vindas.ogg" },
          next: "fim",
        },
        { id: "fim", kind: "complete", complete: { type: "complete", summary: "ok" } },
      ],
    };

    const engine = compilePlaybookFlowToEngine(def);
    const step = engine.steps.audio;
    expect(step.type).toBe("send_media");
    if (step.type === "send_media") {
      expect(step.media_type).toBe("audio");
      expect(step.file).toBe("https://x/boas-vindas.ogg");
      expect(step.next_step).toBe("fim");
    }
  });

  it("propaga split=true em mensagem com split", () => {
    const def: PlaybookFlowDefinition = {
      obra10_playbook_flow_schema: 1,
      entry_step_id: "msg",
      steps: [
        {
          id: "msg",
          kind: "message",
          message: "Bolha 1\n\nBolha 2",
          split: true,
          next: "fim",
        },
        { id: "fim", kind: "complete", complete: { type: "complete", summary: "ok" } },
      ],
    };

    const engine = compilePlaybookFlowToEngine(def);
    const step = engine.steps.msg;
    expect(step.type).toBe("send_text");
    if (step.type === "send_text") {
      expect(step.split).toBe(true);
    }
  });

  it("mensagem com mídia encadeia um passo send_media entre a mensagem e o próximo", () => {
    const def: PlaybookFlowDefinition = {
      obra10_playbook_flow_schema: 1,
      entry_step_id: "msg",
      steps: [
        {
          id: "msg",
          kind: "message",
          message: "Aqui está seu PDF:",
          media: { type: "document", url: "https://x/a.pdf", file_name: "a.pdf" },
          next: "fim",
        },
        { id: "fim", kind: "complete", complete: { type: "complete", summary: "ok" } },
      ],
    };

    const engine = compilePlaybookFlowToEngine(def);
    const msg = engine.steps.msg;
    expect(msg.type).toBe("send_text");
    // A mensagem NÃO aponta direto para "fim"; aponta para um passo de mídia sintético.
    const mediaStepId = msg.type === "send_text" ? msg.next_step : undefined;
    expect(mediaStepId).toBeDefined();
    expect(mediaStepId).not.toBe("fim");
    const mediaStep = mediaStepId ? engine.steps[mediaStepId] : undefined;
    expect(mediaStep?.type).toBe("send_media");
    if (mediaStep && mediaStep.type === "send_media") {
      expect(mediaStep.media_type).toBe("document");
      expect(mediaStep.file).toBe("https://x/a.pdf");
      expect(mediaStep.next_step).toBe("fim");
    }
  });

  it("não quebra os 4 tipos clássicos (message simples continua send_text)", () => {
    const def: PlaybookFlowDefinition = {
      obra10_playbook_flow_schema: 1,
      entry_step_id: "msg",
      steps: [
        { id: "msg", kind: "message", message: "Olá", next: "fim" },
        { id: "fim", kind: "complete", complete: { type: "complete", summary: "ok" } },
      ],
    };

    const engine = compilePlaybookFlowToEngine(def);
    expect(engine.steps.msg.type).toBe("send_text");
    expect(engine.start_step).toBe("msg");
  });
});
