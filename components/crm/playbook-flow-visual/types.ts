"use client";

import type {
  PlaybookFlowInputType,
  PlaybookFlowJourney,
  PlaybookFlowDefinition,
  PlaybookFlowStep,
  PlaybookFlowStepKind,
  PlaybookFlowMenuFormat,
  PlaybookFlowMedia,
} from "@/lib/playbook/flow-definition-types";

export type FlowNodeKind = Extract<
  PlaybookFlowStepKind,
  "message" | "input" | "menu" | "complete" | "send_document" | "send_audio"
>;

export type FlowMenuOption = {
  id: string;
  label: string;
};

export type FlowVisualNodeData = Record<string, unknown> & {
  kind: FlowNodeKind;
  title?: string;
  content: string;
  journey?: PlaybookFlowJourney;
  field?: string;
  inputType?: PlaybookFlowInputType;
  /** Only for menu nodes: list of option labels (ids match edge option ids) */
  menuOptions?: FlowMenuOption[];
  /** Only for menu nodes: native list/button or numbered text */
  menuFormat?: PlaybookFlowMenuFormat;
  /** Step id for stable reference */
  stepId?: string;
  /** Mídia anexada (message → PDF/áudio; send_document/send_audio sempre). */
  media?: PlaybookFlowMedia;
  /** Apenas message: enviar em bolhas separadas (split por \n\n). */
  split?: boolean;
};

export type FlowCanvasSnapshot = {
  definition: PlaybookFlowDefinition;
  nodeCount: number;
  edgeCount: number;
};

const DEFAULT_CONTENT: Record<FlowNodeKind, string> = {
  message: "Mensagem inicial do atendimento.",
  input: "Pergunta para captar um dado do lead.",
  menu: "Escolha uma opção para continuar.",
  complete: "Fluxo concluído.",
  send_document: "Enviar um documento (PDF) ao lead.",
  send_audio: "Enviar um áudio ao lead.",
};

export function summarizeNodeContent(content: string, max = 64): string {
  const clean = String(content ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "Sem conteúdo";
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

export function createDefaultNodeData(kind: FlowNodeKind, order: number): FlowVisualNodeData {
  const id = `step_${order}`;
  return {
    kind,
    title: `${capitalize(kind)} ${order}`,
    content: DEFAULT_CONTENT[kind],
    field: kind === "input" ? `${id}_value` : kind === "menu" ? id : undefined,
    inputType: kind === "input" ? "text" : undefined,
    menuOptions: kind === "menu" ? [{ id: "opcao_1", label: "Opção 1" }] : undefined,
    menuFormat: kind === "menu" ? "text" : undefined,
  };
}

export function toVisualNodeData(step: PlaybookFlowStep): FlowVisualNodeData {
  if (step.kind === "message") {
    return {
      kind: step.kind,
      title: step.title,
      content: step.message,
      journey: step.journey,
      stepId: step.id,
      media: step.media,
      split: step.split,
    };
  }
  if (step.kind === "send_document" || step.kind === "send_audio") {
    return {
      kind: step.kind,
      title: step.title,
      content:
        step.kind === "send_document"
          ? step.message ?? step.media.caption ?? step.media.file_name ?? "Documento"
          : "Áudio",
      journey: step.journey,
      stepId: step.id,
      media: step.media,
    };
  }
  if (step.kind === "input") {
    return {
      kind: step.kind,
      title: step.title,
      content: step.prompt,
      journey: step.journey,
      field: step.field,
      inputType: step.input_type ?? "text",
      stepId: step.id,
    };
  }
  if (step.kind === "menu") {
    return {
      kind: step.kind,
      title: step.title,
      content: step.prompt,
      journey: step.journey,
      field: step.field ?? step.id,
      menuOptions: step.options.map((o) => ({ id: o.id, label: o.label })),
      menuFormat: step.menu_type ?? "list",
      stepId: step.id,
    };
  }
  return {
    kind: step.kind,
    title: step.title,
    content: step.complete.summary ?? "Fluxo concluído",
    journey: step.journey,
    stepId: step.id,
  };
}

function capitalize(value: string): string {
  if (!value) return value;
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
