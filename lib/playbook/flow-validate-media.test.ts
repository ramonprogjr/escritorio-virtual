import { describe, expect, it } from "vitest";
import { validatePlaybookFlowDefinition } from "@/lib/playbook/flow-validate";

function flow(steps: unknown[]) {
  return {
    obra10_playbook_flow_schema: 1,
    entry_step_id: "a",
    steps,
  };
}

describe("validatePlaybookFlowDefinition — send_document / send_audio", () => {
  it("aceita send_document com media válida", () => {
    const res = validatePlaybookFlowDefinition(
      flow([
        {
          id: "a",
          kind: "send_document",
          media: { type: "document", url: "https://x/a.pdf", file_name: "a.pdf" },
          next: "fim",
        },
        { id: "fim", kind: "complete", complete: { type: "complete", summary: "ok" } },
      ])
    );
    expect(res.ok).toBe(true);
  });

  it("aceita send_audio com media válida", () => {
    const res = validatePlaybookFlowDefinition(
      flow([
        { id: "a", kind: "send_audio", media: { type: "audio", url: "https://x/a.ogg" }, next: "fim" },
        { id: "fim", kind: "complete", complete: { type: "complete", summary: "ok" } },
      ])
    );
    expect(res.ok).toBe(true);
  });

  it("aceita mensagem com media e split (campos opcionais)", () => {
    const res = validatePlaybookFlowDefinition(
      flow([
        {
          id: "a",
          kind: "message",
          message: "Olá",
          split: true,
          media: { type: "document", url: "https://x/a.pdf" },
          next: "fim",
        },
        { id: "fim", kind: "complete", complete: { type: "complete", summary: "ok" } },
      ])
    );
    expect(res.ok).toBe(true);
  });

  it("rejeita send_document sem media", () => {
    const res = validatePlaybookFlowDefinition(
      flow([
        { id: "a", kind: "send_document", next: "fim" },
        { id: "fim", kind: "complete", complete: { type: "complete", summary: "ok" } },
      ])
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => e.includes("media"))).toBe(true);
    }
  });

  it("rejeita send_audio com media.type errado", () => {
    const res = validatePlaybookFlowDefinition(
      flow([
        { id: "a", kind: "send_audio", media: { type: "document", url: "https://x/a.pdf" }, next: "fim" },
        { id: "fim", kind: "complete", complete: { type: "complete", summary: "ok" } },
      ])
    );
    expect(res.ok).toBe(false);
  });

  it("rejeita media sem url", () => {
    const res = validatePlaybookFlowDefinition(
      flow([
        { id: "a", kind: "send_document", media: { type: "document", url: "" }, next: "fim" },
        { id: "fim", kind: "complete", complete: { type: "complete", summary: "ok" } },
      ])
    );
    expect(res.ok).toBe(false);
  });

  it("continua válido para os 4 tipos clássicos (regressão)", () => {
    const res = validatePlaybookFlowDefinition(
      flow([
        { id: "a", kind: "message", message: "Olá", next: "m" },
        {
          id: "m",
          kind: "menu",
          prompt: "Escolha:",
          options: [{ id: "o1", label: "Op 1", next: "fim" }],
        },
        { id: "fim", kind: "complete", complete: { type: "complete", summary: "ok" } },
      ])
    );
    expect(res.ok).toBe(true);
  });
});
